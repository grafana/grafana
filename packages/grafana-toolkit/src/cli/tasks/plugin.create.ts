import commandExists from 'command-exists';
import { readFileSync, promises as fs } from 'fs';
import inquirer, { prompt } from 'inquirer';
import kebabCase from 'lodash/kebabCase';
import path from 'path';
import gitPromise from 'simple-git/promise';

import { Task, TaskRunner } from './task';
import { useSpinner } from '../utils/useSpinner';
import { rmdir } from '../utils/rmdir';

const simpleGit = gitPromise(process.cwd());

interface PluginCreateOptions {
  name?: string;
}

interface PluginDetails {
  name: string;
  org: string;
  description: string;
  author: boolean | string;
  url: string;
  keywords: string;
}

const getGitUsername = async () => await simpleGit.raw(['config', '--global', 'user.name']);
const getPluginIdFromName = (name: string) => kebabCase(name);

const verifyGitExists = async () => {
  return new Promise((resolve, reject) => {
    commandExists('git', (err, exists) => {
      if (exists) {
        resolve(true);
      }
      reject(new Error('git is not installed'));
    });
  });
};

type PluginType = 'angular-panel' | 'react-panel' | 'datasource-plugin';

const RepositoriesPaths = {
  'angular-panel': 'git@github.com:grafana/simple-angular-panel.git',
  'react-panel': 'git@github.com:grafana/simple-react-panel.git',
  'datasource-plugin': 'git@github.com:grafana/simple-datasource.git',
};

const promptPluginType = async () =>
  prompt<{ type: PluginType }>([
    {
      type: 'list',
      message: 'Select plugin type',
      name: 'type',
      choices: [
        { name: 'Angular panel', value: 'angular-panel' },
        { name: 'React panel', value: 'react-panel' },
        { name: 'Datasource plugin', value: 'datasource-plugin' },
      ],
    },
  ]);

const promptPluginDetails = async (name?: string) => {
  const username = (await getGitUsername()).trim();
  const responses = await inquirer.prompt<PluginDetails>([
    {
      type: 'input',
      name: 'name',
      default: name,
      message: 'Plugin name:',
    },
    {
      type: 'input',
      name: 'org',
      message: answers => `Organization (used as part of plugin ID <org>-${getPluginIdFromName(answers.name)}):`,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
    },
    {
      type: 'input',
      name: 'keywords',
      message: 'Keywords(separated by comma):',
    },
    {
      type: 'confirm',
      name: 'author',
      when: username !== '',
      message: `Author (${username}):`,
    },
    {
      type: 'input',
      name: 'author',
      // Prompt for manual author entry if no git user.name specifed
      when: answers => !answers.author || username === '',
      message: `Author:`,
    },
    {
      type: 'input',
      name: 'url',
      message: `Your URL(i.e. organisation url):`,
    },
  ]);

  return {
    ...responses,
    author: responses.author === true ? username : responses.author,
  };
};

const fetchTemplate = useSpinner<{ type: PluginType; dest: string }>(
  'Fetching plugin template...',
  async ({ type, dest }) => {
    const url = RepositoriesPaths[type];
    if (!url) {
      throw new Error('Unknown plugin type');
    }

    await simpleGit.clone(url, dest);
  }
);

const prepareJsonFiles = useSpinner<{ pluginDetails: PluginDetails; pluginPath: string }>(
  'Saving package.json and plugin.json files',
  async ({ pluginDetails, pluginPath }) => {
    const packageJsonPath = path.resolve(pluginPath, 'package.json');
    const pluginJsonPath = path.resolve(pluginPath, 'src/plugin.json');
    const packageJson: any = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const pluginJson: any = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));

    const pluginId = `${kebabCase(pluginDetails.org)}-${getPluginIdFromName(pluginDetails.name)}`;
    packageJson.name = pluginId;
    packageJson.author = pluginDetails.author;
    packageJson.description = pluginDetails.description;

    pluginJson.name = pluginDetails.name;
    pluginJson.id = pluginId;
    pluginJson.info = {
      ...pluginJson.info,
      description: pluginDetails.description,
      author: {
        name: pluginDetails.author,
        url: pluginDetails.url,
      },
      keywords: pluginDetails.keywords.split(',').map(k => k.trim()),
    };

    await Promise.all(
      [packageJson, pluginJson].map((f, i) => {
        const filePath = i === 0 ? packageJsonPath : pluginJsonPath;
        return fs.writeFile(filePath, JSON.stringify(f, null, 2));
      })
    );
  }
);

export const removeGitFiles = useSpinner('Cleaning', async pluginPath => rmdir(`${path.resolve(pluginPath, '.git')}`));

const pluginCreateRunner: TaskRunner<PluginCreateOptions> = async ({ name }) => {
  const destPath = path.resolve(process.cwd(), name || '');

  // 1. Verifying if git exists in user's env as templates are cloned from git templates
  await verifyGitExists();
  // 2. Prompt plugin template
  const { type } = await promptPluginType();
  // 3. Fetch plugin template from Github
  await fetchTemplate({ type, dest: destPath });
  // 4. Prompt plugin details
  const pluginDetails = await promptPluginDetails(name);
  // 5. Update json files (package.json, src/plugin.json)
  await prepareJsonFiles({ pluginDetails, pluginPath: destPath });
  // 6. Remove cloned repository .git dir
  await removeGitFiles(destPath);
};

export const pluginCreateTask = new Task<PluginCreateOptions>('plugin:create task', pluginCreateRunner);
