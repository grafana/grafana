import { prompt } from 'inquirer';
import path from 'path';
import { promptConfirm } from '../utils/prompt';
import {
  fetchTemplate,
  formatPluginDetails,
  getPluginIdFromName,
  prepareJsonFiles,
  printGrafanaTutorialsDetails,
  promptPluginDetails,
  promptPluginType,
  removeGitFiles,
  verifyGitExists,
} from './plugin/create';
import { Task, TaskRunner } from './task';

interface PluginCreateOptions {
  name?: string;
}

const pluginCreateRunner: TaskRunner<PluginCreateOptions> = async ({ name }) => {
  const destPath = path.resolve(process.cwd(), getPluginIdFromName(name || ''));
  let pluginDetails;

  // 1. Verifying if git exists in user's env as templates are cloned from git templates
  await verifyGitExists();

  // 2. Prompt plugin template
  const { type } = await promptPluginType();

  // 3. Fetch plugin template from Github
  await fetchTemplate({ type, dest: destPath });

  // 4. Prompt plugin details
  do {
    pluginDetails = await promptPluginDetails(name);
    formatPluginDetails(pluginDetails);
  } while ((await prompt<{ confirm: boolean }>(promptConfirm('confirm', 'Is that ok?'))).confirm === false);

  // 5. Update json files (package.json, src/plugin.json)
  await prepareJsonFiles({ type: type, pluginDetails, pluginPath: destPath });

  // 6. Remove cloned repository .git dir
  await removeGitFiles(destPath);

  // 7. Promote Grafana Tutorials :)
  printGrafanaTutorialsDetails(type);
};

export const pluginCreateTask = new Task<PluginCreateOptions>('plugin:create task', pluginCreateRunner);
