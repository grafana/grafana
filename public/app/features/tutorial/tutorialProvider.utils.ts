// import { locationService } from '@grafana/runtime';
import type { Step, RequiredAction, ClickAction, ChangeAction } from './types';

export function setupTutorialStep(step: Step, onComplete: () => void) {
  waitForElement(step.target).then((element) => {
    if (step.requiredActions) {
      resolveRequiredActions(step.requiredActions).then(() => {
        onComplete();
      });
    }
  });
}

export function waitForElement<T extends Element = Element>(selector: string): Promise<T> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const element = document.querySelector<T>(selector);

      if (element) {
        clearInterval(interval);

        hasElementStoppedAnimating(element).then(() => {
          requestAnimationFrame(() => {
            resolve(element);
          });
        });
      }
    }, 30);
  });
}

// TODO: FIX THIS
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
        resolve(true);
      }
    }, 150);
  });
}

async function resolveRequiredActions(requiredActions: RequiredAction[]) {
  for (const action of requiredActions) {
    await setUpRequiredAction(action);
  }

  return true;
}

function setUpRequiredAction(action: RequiredAction) {
  return new Promise((resolve) => {
    const { target } = action;
    waitForElement(target).then((targetElement) => {
      if (isClickAction(action)) {
        setupClickAction(targetElement, resolve);
      }

      if (isChangeAction(action)) {
        setupChangeAction(targetElement, action, resolve);
      }
    });
  });
}

function setupClickAction(targetElement: Element, onComplete: (value: unknown) => void) {
  targetElement.addEventListener('click', onComplete, { once: true });
}

function setupChangeAction(targetElement: Element, action: ChangeAction, onComplete: (value: unknown) => void) {
  if (targetElement.getAttribute(action.attribute.name) === action.attribute.value) {
    onComplete(action.attribute.value);
    return;
  }

  const observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      const newValue = targetElement.getAttribute(action.attribute.name);
      const isCorrectAttribute = mutation.attributeName === action.attribute.name;
      const isCorrectValue = newValue === action.attribute.value;

      if (mutation.type === 'attributes' && isCorrectAttribute && isCorrectValue) {
        onComplete(newValue);
        observer.disconnect();
        return;
      }
    }
  });

  observer.observe(targetElement, { attributes: true, attributeFilter: [action.attribute.name] });
}

function isClickAction(action: RequiredAction): action is ClickAction {
  return action.action === 'click';
}

function isChangeAction(action: RequiredAction): action is ChangeAction {
  return action.action === 'change';
}

export function getElementByXpath(path: string) {
  const reactRoot = document.getElementById('reactRoot') as Element;
  return document.evaluate(path, reactRoot, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
