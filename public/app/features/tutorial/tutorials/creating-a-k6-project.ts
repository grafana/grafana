import type { Step, Tutorial } from '../types';

import { checkMenuStep } from './reusable/check-menu';

const info = {
  id: 'creating-a-k6-project',
  name: 'Creating a project in k6',
  description: `This is a tutorial to help you create a project in k6.`,
  tags: {
    highlight: `Feature`,
    area: `k6 Cloud`,
    type: `Interactive`,
  },
  author: `k6`,
};

const tutorialSteps: Step[] = [
  checkMenuStep,
  {
    target: `[href='/a/k6-app']`,
    title: `Go to Performance Testing`,
    content: `k6 is the best developer tool for performance testing.`,
    placement: `right`,
    requiredActions: [
      {
        target: `[href='/a/k6-app']`,
        action: 'click',
      },
    ],
  },
  {
    route: `/a/k6-app/projects`,
    target: `[aria-label='Create new project']`,
    title: `Create a project`,
    content: `All of your tests have to be organised in projects, let's create one.`,
    requiredActions: [
      {
        target: `[aria-label='Create new project']`,
        action: 'click',
      },
    ],
  },
  {
    route: `/a/k6-app/projects`,
    target: `[placeholder='Enter project name']`,
    title: `Name your project`,
    content: `Give your project a name.`,
    requiredActions: [
      {
        target: `[placeholder='Enter project name']`,
        action: 'input',
        regEx: '/^(?!s*$).+/',
      },
    ],
  },
  {
    route: `/a/k6-app/projects`,
    target: `[placeholder='Enter project name']`,
    title: `Great job!`,
    content: `Once you're done, you can adjust your project limits then click on the 'Create new project' button. You will see your new project in the projects list.`,
  },
];

export const creatingAk6Project: Tutorial = {
  ...info,
  steps: tutorialSteps,
};
