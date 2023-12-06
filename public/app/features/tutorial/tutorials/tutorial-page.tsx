import type { Step, Tutorial } from '../types';

const info = {
  id: 'using-the-tutorialPage',
  name: 'Exploring the tutorial page',
  description: `This is a tutorial that is about to get very meta.`,
  author: `Grafana Labs`,
};

const tutorialSteps: Step[] = [
  {
    target: `[data-testid="import-tutorials"]`,
    title: `Import tutorials`,
    content: `This is where you can import tutorials. All tutorials are written in plain json so can be easily shared.`,
    placement: `left`,
  },
  {
    target: `[data-testid="tutorial-list Grafana Labs"]`,
    title: `Grafana Labs tutorials`,
    content: `All tutorials have authors. We segment them by author -- here you can see the Grafana Labs tutorials.`,
  },
  {
    target: `[data-testid="tutorial-item using-the-tutorialPage"]`,
    title: `Tutorial item`,
    content: `This is a tutorial item that gives a quick overview of the tutorial. You can preview or start the tutorial from here.`,
  },
  {
    target: `[data-testid="tutorial-item using-the-tutorialPage"] [data-testid="tutorial-progress"]`,
    title: `Tutorial progress`,
    content: `This is your progress through the tutorial. You're doing great!`,
  },
  {
    target: `[data-testid="tutorial-item using-the-tutorialPage"] [data-testid="tutorial-item preview"]`,
    title: `Tutorial preview`,
    content: `Before you start a tutorial, you can preview it. This will show you the steps and what you'll be doing.`,
    requiredActions: [
      {
        action: `click`,
        target: `[data-testid="tutorial-item using-the-tutorialPage"] [data-testid="tutorial-item preview"]`,
      },
    ],
    skipConditions: [
      {
        condition: `visible`,
        target: `[data-testid="tutorial-preview"]`,
      },
    ],
  },
  {
    target: `[data-testid="tutorial-preview"]`,
    title: `Tutorial preview`,
    content: `This is the tutorial preview. You can see the steps and what you'll be doing. It'll even show you your progress through the tutorial and far you got if you stopped before the end.`,
    placement: `left`,
  },
];

export const tutorialPageTutorial: Tutorial = {
  ...info,
  steps: tutorialSteps,
};
