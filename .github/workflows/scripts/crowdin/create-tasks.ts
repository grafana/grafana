import crowdinImport from '@crowdin/crowdin-api-client';
const TRANSLATED_CONNECTOR_DESCRIPTION = '{{tos_service_type: premium}}';
const TRANSLATE_BY_VENDOR_WORKFLOW_TYPE = 'TranslateByVendor'

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

const { tasksApi, projectsGroupsApi, sourceFilesApi, workflowsApi } = new crowdin(credentials);

// first, clean up any existing completed tasks
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

// then create new tasks for each language
const languages = await getLanguages(PROJECT_ID);
const fileIds = await getFileIds(PROJECT_ID);
const workflowStepId = await getWorkflowStepId(PROJECT_ID);

for (const language of languages) {
  const { name, id } = language;
  await createTask(PROJECT_ID, `Translate to ${name}`, id, fileIds, workflowStepId);
}

async function getLanguages(projectId: number) {
  try {
    const project = await projectsGroupsApi.getProject(projectId);
    const languages = project.data.targetLanguages;
    console.log('Fetched languages successfully!');
    return languages;
  } catch (error) {
    console.error('Failed to fetch languages: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function getFileIds(projectId: number) {
  try {
    const response = await sourceFilesApi.listProjectFiles(projectId);
    const files = response.data;
    const fileIds = files.map(file => file.data.id);
    console.log('Fetched file ids successfully!');
    return fileIds;
  } catch (error) {
    console.error('Failed to fetch file IDs: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function getWorkflowStepId(projectId: number) {
  try {
    const response = await workflowsApi.listWorkflowSteps(projectId);
    const workflowSteps = response.data;
    const workflowStepId = workflowSteps.find(step => step.data.type === TRANSLATE_BY_VENDOR_WORKFLOW_TYPE)?.data.id;
    if (!workflowStepId) {
      throw new Error(`Workflow step with type "${TRANSLATE_BY_VENDOR_WORKFLOW_TYPE}" not found`);
    }
    console.log('Fetched workflow step ID successfully!');
    return workflowStepId;
  } catch (error) {
    console.error('Failed to fetch workflow step ID: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function createTask(projectId: number, title: string, languageId: string, fileIds: number[], workflowStepId: number) {
  try {
    const taskParams = {
      title,
      description: TRANSLATED_CONNECTOR_DESCRIPTION,
      languageId,
      workflowStepId,
      skipAssignedStrings: true,
      fileIds,
    };

    console.log(`Creating Crowdin task: "${title}" for language ${languageId}`);

    const response = await tasksApi.addTask(projectId, taskParams);
    console.log(`Task created successfully! Task ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to create Crowdin task: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
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
