import crowdin from '@crowdin/crowdin-api-client';
const TRANSLATED_CONNECTOR_DESCRIPTION = '{{tos_service_type: premium}}';

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

const { tasksApi, projectsGroupsApi, sourceFilesApi } = new crowdin.default(credentials);

const languages = await getLanguages(PROJECT_ID);
const fileIds = await getFileIds(PROJECT_ID);

// for (const language of languages) {
  const { name, id } = languages[0];
  await createTask(PROJECT_ID, `Translate to ${name}`, id, fileIds);
// }

async function getLanguages(projectId) {
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

async function getFileIds(projectId) {
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

async function createTask(projectId, title, languageId, fileIds) {
  try {
    const taskParams = {
      title,
      // description: TRANSLATED_CONNECTOR_DESCRIPTION,
      description: 'test',
      languageId,
      type: 2, // Translation by vendor
      workflowStepId: 78, // Translation step ID
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
