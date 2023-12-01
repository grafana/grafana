import { Placement } from '@popperjs/core';
import { type ReactNode } from 'react';

// import { locationService } from '@grafana/runtime';

export type Step = {
  route: string;
  target: string;
  content?: ReactNode;
  title?: ReactNode;
  placement?: Placement;
  requiredActions?: RequiredAction[];
};

type RequiredActionBase = {
  target: string;
};

export type ClickAction = RequiredActionBase & {
  action: 'click' | 'change';
};

export type ChangeAction = RequiredActionBase & {
  action: 'change';
  attribute: { name: string; value: string };
};

export type RequiredAction = ClickAction | ChangeAction;

export const tutorialSteps: Step[] = [
  {
    route: `/explore`,
    target: `[data-testid*="Select a data source"]`,
    title: `Let's get started`,
    content: 'Pick the prometheus datasource!',
    requiredActions: [
      {
        target: `[data-testid*="Select a data source"]`,
        action: 'change',
        attribute: {
          name: 'placeholder',
          value: 'grafanacloud-ckbedwellksix-prom',
        },
      },
    ],
  },
  {
    route: `/explore`,
    target: `[data-testid*="Select a data source"]`,
    title: `The prometheus datasource is selected`,
    content: `Awesome, let's take a look at what you can do next!`,
  },
  {
    route: `/explore`,
    target: `[aria-label="Query patterns"]`,
    title: `Turbo charge`,
    content: `This is the 'Kick start your query' button. It will help you get started with your first query!`,
  },
  {
    route: `/explore`,
    target: `[aria-label="Toggle switch"]`,
    title: `ELI5`,
    content: `Give it a go!`,
    requiredActions: [
      {
        target: `[aria-label="Toggle switch"]`,
        action: 'click',
      },
    ],
  },
];

export function waitForElement<T extends Element = Element>(selector: string): Promise<T> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const element = document.querySelector<T>(selector);
      if (element && element.getBoundingClientRect().width > 0) {
        clearInterval(interval);

        requestAnimationFrame(() => {
          resolve(element);
        });
      }
    }, 30);
  });
}

export function getElementByXpath(path: string) {
  const reactRoot = document.getElementById('reactRoot') as Element;
  return document.evaluate(path, reactRoot, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
