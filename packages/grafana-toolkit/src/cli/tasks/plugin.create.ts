import { prompt } from 'inquirer';
import path from 'path';

import { Task, TaskRunner } from './task';
import { promptConfirm } from '../utils/prompt';
import {
  getPluginIdFromName,
  verifyGitExists,
  promptPluginType,
  fetchTemplate,
  promptPluginDetails,
  formatPluginDetails,
  prepareJsonFiles,
  removeGitFiles,
} from './plugin/create';

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
  await prepareJsonFiles({ pluginDetails, pluginPath: destPath });

  // 6. Remove cloned repository .git dir
  await removeGitFiles(destPath);
};

export const pluginCreateTask = new Task<PluginCreateOptions>('plugin:create task', pluginCreateRunner);
