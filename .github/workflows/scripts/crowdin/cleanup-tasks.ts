import crowdinImport from '@crowdin/crowdin-api-client';

// TODO Remove this type assertion when https://github.com/crowdin/crowdin-api-client-js/issues/508 is fixed
// @ts-expect-error
const crowdin = crowdinImport.default as typeof crowdinImport;

const API_TOKEN = process.env.CROWDIN_PERSONAL_TOKEN;
if (!API_TOKEN) {
  console.error('Error: CROWDIN_PERSONAL_TOKEN environment variable is not set');
  process.exit(1);
}

const PROJECT_ID = process.env.CROWDIN_PROJECT_ID ? parseInt(process.env.CROWDIN_PROJECT_ID, 10) : undefined;
if (!PROJECT_ID) {
  console.error('Error: CROWDIN_PROJECT_ID environment variable is not set');
  process.exit(1);
}

const credentials = {
  token: API_TOKEN,
  organization: 'grafana'
};

const { tasksApi } = new crowdin(credentials);

const tasks = await listTasks(PROJECT_ID);
for (const task of tasks) {
  const { id, status, progress } = task.data;
  if (status === 'todo' && progress.done === progress.total) {
    console.log(`Marking task ${id} as done`);
    await markTaskAsDone(PROJECT_ID, id);
  } else {
    console.log(`Task ${id} is not done, skipping`);
  }
}

async function listTasks(projectId: number) {
  try {
    const listTasksParams = {
      limit: 500,
    }
    const response = await tasksApi.listTasks(projectId, listTasksParams);
    const tasks = response.data;
    console.log('Fetched tasks successfully!');
    return tasks;
  } catch (error) {
    console.error('Failed to fetch tasks: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function markTaskAsDone(projectId: number, taskId: number) {
  try {
    const response = await tasksApi.editTask(projectId, taskId, [{
      op: 'replace',
      path: '/status',
      value: 'done',
    }]);
    console.log(`Task ${taskId} marked as done successfully!`);
    return response.data;
  } catch (error) {
    console.error('Failed to mark task as done: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}
