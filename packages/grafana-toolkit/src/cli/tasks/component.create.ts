import { Task, TaskRunner } from './task';
import fs from 'fs';
import _ from 'lodash';
import { pascalCase } from '../utils/pascalCase';
import { prompt } from 'inquirer';
import { promptConfirm, promptInput } from '../utils/prompt';
import { componentTpl, docsTpl, storyTpl, testTpl } from '../templates';

interface Details {
  name?: string;
  hasStory: boolean;
  group: string;
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
    promptConfirm('hasTests', "Generate component's test file?"),
    promptConfirm('hasStory', "Generate component's story?"),
    promptInput('group', 'Select component group (e.g. Forms, Layout)', true, 'General', ({ hasStory }) => hasStory),
  ]);
};

export const generateComponents: ComponentGenerator = async ({ details, path }) => {
  const name = pascalCase(details.name);
  const getCompiled = (template: string) => {
    return _.template(template)({ ...details, name });
  };
  const filePath = `${path}/${name}`;
  const paths = [];

  fs.writeFileSync(`${filePath}.tsx`, getCompiled(componentTpl));
  paths.push(`${filePath}.tsx`);

  if (details.hasTests) {
    fs.writeFileSync(`${filePath}.test.tsx`, getCompiled(testTpl));
    paths.push(`${filePath}.test.tsx`);
  }

  if (details.hasStory) {
    fs.writeFileSync(`${filePath}.story.tsx`, getCompiled(storyTpl));
    fs.writeFileSync(`${filePath}.mdx`, getCompiled(docsTpl));
    paths.push(`${filePath}.story.tsx`, `${filePath}.mdx`);
  }

  console.log('Generated files:');
  console.log(paths.join('\n'));
};

const componentCreateRunner: TaskRunner<never> = async () => {
  const destPath = process.cwd();
  let details = await promptDetails();
  await generateComponents({ details, path: destPath });
};
export const componentCreateTask = new Task('component:create', componentCreateRunner);
