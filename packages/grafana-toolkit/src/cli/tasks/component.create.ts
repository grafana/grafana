import { Task, TaskRunner } from './task';
import fs from 'fs';
import _ from 'lodash';
import { pascalCase } from '../utils/pascalCase';
import { prompt } from 'inquirer';
import { promptConfirm, promptInput } from '../utils/prompt';
import { componentTpl, docsTpl, storyTpl } from '../templates';

interface Details {
  name?: string;
  hasStory: boolean;
  storyType: string;
  hasTests: boolean;
}

interface GeneratorOptions {
  details: Details;
  path: string;
}

type ComponentGenerator = (options: GeneratorOptions) => Promise<any>;

export const promptDetails = () => {
  return prompt<Details>([
    promptInput('name', 'Component name', true, ''),
    promptConfirm('hasStory', "Generate component's story?"),
    promptInput('storyType', 'Select story type (default General)', true, 'General', ({ hasStory }) => hasStory),
  ]);
};

export const generateComponents: ComponentGenerator = async ({ details, path }) => {
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

const componentCreateRunner: TaskRunner<never> = async () => {
  const destPath = process.cwd();
  let details = await promptDetails();
  await generateComponents({ details, path: destPath });
};
export const componentCreateTask = new Task('component:create', componentCreateRunner);
