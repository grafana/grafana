const crowdin = require('@crowdin/crowdin-api-client');
const TRANSLATED_CONNECTOR_DESCRIPTION = '{{tos_service_type: premium}}';

const apiToken = process.env.CROWDIN_PERSONAL_TOKEN;
if (!apiToken) {
  console.error('Error: CROWDIN_PERSONAL_TOKEN environment variable is not set');
  process.exit(1);
}

const projectId = process.env.CROWDIN_PROJECT_ID;
if (!projectId) {
  console.error('Error: CROWDIN_PROJECT_ID environment variable is not set');
  process.exit(1);
}

const { tasksApi, projectsGroupsApi, sourceFilesApi } = new crowdin.default({
  token: apiToken,
  organization: 'grafana'
});

const languages = await getLanguages();
const fileIds = await getFileIds();
console.log('Languages: ', languages);
console.log('File IDs: ', fileIds);

// for (const language of languages) {
//   const { name, id } = language;
//   await createTask(`Translate to ${name}`, id, fileIds);
// }

async function getLanguages() {
  try {
    const project = await projectsGroupsApi.getProject(projectId);
    const languages = project.data.targetLanguages;
    return languages;
  } catch (error) {
    console.error('Failed to fetch languages: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function getFileIds() {
  try {
    const response = await sourceFilesApi.listProjectFiles(projectId);
    const files = response.data;
    const fileIds = files.map(file => file.data.id);
    return fileIds;
  } catch (error) {
    console.error('Failed to fetch file IDs: ', error.message);
    if (error.response && error.response.data) {
      console.error('Error details: ', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function createTask(title, languageId, fileIds) {
  try {
    const taskParams = {
      title,
      description: TRANSLATED_CONNECTOR_DESCRIPTION,
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
