import { Task, TaskRunner } from './task';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import { pascalCase } from '../utils/pascalCase';
import { getPluginIdFromName } from './plugin/create';
import { prompt } from 'inquirer';
import { promptConfirm, promptInput } from '../utils/prompt';
import { useSpinner } from '../utils/useSpinner';
import { componentTpl, docsTpl, storyTpl } from '../templates';

interface Options {
  name?: string;
}

interface Details {
  name?: string;
  hasStory: boolean;
}
export const promptPluginDetails = (name?: string) => {
  return prompt<Details>([
    promptInput('name', "Component's name", true, name),
    promptConfirm('hasStory', "Generate component's story?"),
  ]);
};

export const generateComponents = useSpinner('Generating components', async ({ details, path }) => {
  console.log('generating', details, path);
  const name = pascalCase(details.name);
  const string = _.template(componentTpl)({ name });
  fs.writeFileSync(`${path}/${name}.tsx`, string);
});

const componentCreateRunner: TaskRunner<Options> = async ({ name }) => {
  console.log('running', name);
  const destPath = path.resolve(process.cwd(), getPluginIdFromName(name || ''));
  let details = await promptPluginDetails(name);
  await generateComponents({ details, path: destPath });
};
export const componentCreateTask = new Task('component:create task', componentCreateRunner);
