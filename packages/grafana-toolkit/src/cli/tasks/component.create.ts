import fs from 'fs';
import { prompt } from 'inquirer';
import { template as _template } from 'lodash';

import { componentTpl, docsTpl, storyTpl, testTpl } from '../templates';
import { pascalCase } from '../utils/pascalCase';
import { promptConfirm, promptInput, promptList } from '../utils/prompt';

import { Task, TaskRunner } from './task';

interface Details {
  name?: string;
  hasStory: boolean;
  group?: string;
  isStoryPublic: boolean;
  hasTests: boolean;
}

interface GeneratorOptions {
  details: Details;
  path: string;
}

type ComponentGenerator = (options: GeneratorOptions) => Promise<any>;

const componentGroups = [
  { name: 'General', value: 'General' },
  { name: 'Forms', value: 'Forms' },
  { name: 'Panel', value: 'Panel' },
  { name: 'Visualizations', value: 'Visualizations' },
  { name: 'Others', value: 'Others' },
];

export const promptDetails = () => {
  return prompt<Details>([
    promptInput('name', 'Component name', true),
    promptConfirm('hasTests', "Generate component's test file?"),
    promptConfirm('hasStory', "Generate component's story file?"),
    promptConfirm(
      'isStoryPublic',
      'Generate public story? (Selecting "No" will create an internal story)',
      true,
      ({ hasStory }) => hasStory
    ),
    promptList(
      'group',
      'Select component group for the story (e.g. Forms, Layout)',
      () => componentGroups,
      0,
      ({ hasStory }) => hasStory
    ),
  ]);
};

export const generateComponents: ComponentGenerator = async ({ details, path }) => {
  const name = pascalCase(details.name);
  const getCompiled = (template: string) => {
    return _template(template)({ ...details, name });
  };
  const filePath = `${path}/${name}`;
  let paths = [];

  fs.writeFileSync(`${filePath}.tsx`, getCompiled(componentTpl));
  paths.push(`${filePath}.tsx`);

  if (details.hasTests) {
    fs.writeFileSync(`${filePath}.test.tsx`, getCompiled(testTpl));
    paths.push(`${filePath}.test.tsx`);
  }

  if (details.hasStory) {
    const storyExt = details.isStoryPublic ? '.story.tsx' : '.story.internal.tsx';
    fs.writeFileSync(`${filePath}${storyExt}`, getCompiled(storyTpl));
    fs.writeFileSync(`${filePath}.mdx`, getCompiled(docsTpl));
    paths.push(`${filePath}${storyExt}`, `${filePath}.mdx`);
  }

  console.log('Generated files:');
  console.log(paths.join('\n'));
};

const componentCreateRunner: TaskRunner<any> = async () => {
  const destPath = process.cwd();
  const details = await promptDetails();
  await generateComponents({ details, path: destPath });
};

export const componentCreateTask = new Task('component:create', componentCreateRunner);
