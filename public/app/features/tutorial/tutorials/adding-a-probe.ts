import type { Step, Tutorial } from '../types';

import { checkMenuStep } from './reusable/check-menu';

const info = {
  id: 'adding-a-probe',
  name: 'Adding a probe in Synthetic Monitoring',
  description: `Synthetic Monitoring has the ability to run tests from multiple locations around the world. These locations are called probes. This tutorial will show you how to add a probe to your project.`,
  tags: {
    highlight: `Feature`,
    area: `Synthetic Monitoring`,
    type: `Interactive`,
  },
  author: `k6`,
};

const tutorialSteps: Step[] = [
  checkMenuStep,
  {
    target: `[aria-label*='section Frontend']`,
    title: `Expand the Frontend section`,
    content: `Synthetic Monitoring lives under Frontend (for some reason?). Let's expand it.`,
    placement: `right`,
    requiredActions: [
      {
        target: `[aria-label*='section Frontend']`,
        action: 'click',
      },
    ],
    skipConditions: [
      {
        condition: `visible`,
        target: `[href='/a/grafana-synthetic-monitoring-app/home']`,
      },
    ],
  },
  {
    target: `[aria-label*='section Synthetics']`,
    title: `Expand the Synthetics section`,
    content: `Probes are a sub-item of Synthetics. Let's expand it.`,
    placement: `right`,
    requiredActions: [
      {
        target: `[aria-label*='section Synthetics']`,
        action: 'click',
      },
    ],
    skipConditions: [
      {
        condition: `visible`,
        target: `[href='/a/grafana-synthetic-monitoring-app/probes']`,
      },
    ],
  },
  {
    target: `[href='/a/grafana-synthetic-monitoring-app/probes']`,
    title: `Go to probes`,
    content: `Here we will find a list of all public and private probes, as well as the ability to add a new probe.`,
    placement: `right`,
    requiredActions: [
      {
        target: `[href='/a/grafana-synthetic-monitoring-app/probes']`,
        action: 'click',
      },
    ],
  },
  {
    target: `[href='/a/grafana-synthetic-monitoring-app/probes/new']`,
    title: `Add a new probe`,
    content: `The only kind of probe you can add is a private probe. This is a probe that you can run tests from, but no one else can. Let's add one.`,
    placement: `right`,
    requiredActions: [
      {
        target: `[href='/a/grafana-synthetic-monitoring-app/probes/new']`,
        action: 'click',
      },
    ],
  },
  {
    target: `input[aria-label='Probe name']`,
    title: `Name your probe`,
    content: `Give your probe a name.`,
    placement: `right`,
    requiredActions: [
      {
        target: `input[aria-label='Probe name']`,
        action: 'input',
        regEx: '/^(?!s*$).+/',
      },
    ],
  },
  {
    target: `input[aria-label='Region']`,
    title: `Add a region to your probe`,
    content: `This is a useful taxonomy so you can group similar probes together.`,
    placement: `right`,
    requiredActions: [
      {
        target: `input[aria-label='Region']`,
        action: 'input',
        regEx: '/^(?!s*$).+/',
      },
    ],
  },
  {
    target: `button[type='submit']`,
    title: `Send that probe!`,
    content: `Once you're done, you can click on the 'Add new probe' button. You will be returned to the probes list where you will now see it listed.`,
    placement: `right`,
  },
];

export const addingAProbe: Tutorial = {
  ...info,
  steps: tutorialSteps,
};
