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

export function waitForElement<T extends Element = Element>(selector: string): Promise<T> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const element = document.querySelector<T>(selector);

      if (element) {
        hasElementStoppedAnimating(element).then(() => {
          clearInterval(interval);

          requestAnimationFrame(() => {
            console.log(element);
            resolve(element);
          });
        });
      }
    }, 30);
  });
}

function hasElementStoppedAnimating(element: Element) {
  return new Promise((resolve) => {
    let lastX: number;
    let lastY: number;

    const interval = setInterval(() => {
      const currentX = element.getBoundingClientRect().x;
      const currentY = element.getBoundingClientRect().y;

      if (lastX !== currentX || lastY !== currentY) {
        lastX = currentX;
        lastY = currentY;
      }

      if (currentX === lastX && currentY === lastY) {
        clearInterval(interval);
        resolve(false);
      }
    }, 150);
  });
}

export function getElementByXpath(path: string) {
  const reactRoot = document.getElementById('reactRoot') as Element;
  return document.evaluate(path, reactRoot, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
