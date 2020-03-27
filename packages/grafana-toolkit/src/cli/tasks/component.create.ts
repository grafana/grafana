import { Task, TaskRunner } from './task';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import { pascalCase } from '../utils/pascalCase';
import { getPluginIdFromName } from './plugin/create';
import { prompt } from 'inquirer';
import { promptConfirm, promptInput } from '../utils/prompt';
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
    promptInput('name', 'Component name', true, ''),
    promptConfirm('hasStory', "Generate component's story?"),
    promptInput('storyType', 'Select story type (default General)', true, 'General', ({ hasStory }) => hasStory),
  ]);
};

export const generateComponents = async ({ details, path }) => {
  console.log('Generating components in: ', path);
  const name = pascalCase(details.name);
  const str = _.template(componentTpl)({ name });
  fs.writeFileSync(`${path}/${name}.tsx`, str);

  if (details.hasStory) {
    const storyStr = _.template(storyTpl)({ name, type: details.storyType });
    fs.writeFileSync(`${path}/${name}.story.tsx`, storyStr);
    const docsStr = _.template(docsTpl)({ name });
    fs.writeFileSync(`${path}/${name}.mdx`, docsStr);
  }
};

const componentCreateRunner: TaskRunner<Options> = async ({ name }) => {
  const destPath = path.resolve(process.cwd(), getPluginIdFromName(name || ''));
  let details = await promptPluginDetails(name);
  await generateComponents({ details, path: destPath });
};
export const componentCreateTask = new Task('component:create task', componentCreateRunner);
