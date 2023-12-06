import type { Step, Tutorial } from '../types';

import { goToMenuStep } from './reusable/goToMenu';

const info = {
  id: 'setting-up-a-data-source',
  name: 'Setting up a data source',
  description: `This is a tutorial to help you adding your first data source.`,
  author: `Grafana Labs`,
};

const tutorialSteps: Step[] = [
  goToMenuStep,
  {
    target: `[aria-label="Collapse section Connections"]`,
    title: `Open the connections section`,
    content:
      'The side navigation has collapsable sections. Sub-items can live under these sections, denoted by these chevrons.',
    requiredActions: [
      {
        target: `[aria-label="Collapse section Connections"]`,
        action: 'click',
      },
    ],
    skipConditions: [
      {
        target: `[href="/connections/datasources"]`,
        condition: 'visible',
      },
    ],
  },
  {
    target: `[href="/connections/datasources"]`,
    title: `Go to Data Sources`,
    content: 'This will take you to data sources.',
    requiredActions: [
      {
        target: `[href="/connections/datasources"]`,
        action: 'click',
      },
    ],
  },
];

export const settingUpADatasourceTutorial: Tutorial = {
  ...info,
  steps: tutorialSteps,
};
