// import { locationService } from '@grafana/runtime';
import { debounce } from 'lodash';

import { TUTORIAL_EXIT_EVENT } from './constants';
import type {
  Attribute,
  RequiredAction,
  ClickAction,
  ChangeAction,
  InputAction,
  StringAttribute,
  RegExpAttribute,
} from './types';

export function waitForElement<T extends Element = Element>(selector: string, timeout = 500): Promise<T> {
  return new Promise((resolve, reject) => {
    let stopWaiting: NodeJS.Timeout;

    const resolver = (element: T) => {
      if (!isElementInView(element)) {
        element.scrollIntoView({ behavior: 'auto' });
      }
      return hasElementStoppedAnimating(element).then(() => {
        requestAnimationFrame(() => {
          console.log(`${selector}: Found element `);
          resolve(element);
        });
      });
    };

    const rejecter = () => {
      clearInterval(interval);
      clearTimeout(stopWaiting);
      console.error(`${selector}: waitForElement timed out waiting`);
      reject(null);
    };

    const element = document.querySelector<T>(selector);

    if (element) {
      resolver(element);
      return;
    }

    const interval = setInterval(() => {
      const element = document.querySelector<T>(selector);

      if (element) {
        clearInterval(interval);
        clearTimeout(stopWaiting);
        resolver(element);
      }
    }, 30);

    const giveUp = () => {
      const spinnerPresent = document.querySelector('[data-testid="Spinner"]');

      if (spinnerPresent) {
        console.log(`Found spinner, will wait for another ${timeout}ms`);
        clearTimeout(stopWaiting);
        stopWaiting = setTimeout(giveUp, timeout);
      }

      if (!spinnerPresent) {
        rejecter();
      }
    };

    stopWaiting = setTimeout(giveUp, timeout);
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

function isElementInView(element: Element) {
  const { top, bottom } = element.getBoundingClientRect();
  const windowHeight = window.innerHeight;

  return top > 0 && bottom < windowHeight;
}

export async function resolveRequiredActions(
  requiredActions: RequiredAction[],
  onComplete: (action: RequiredAction) => void
) {
  for (const action of requiredActions) {
    await setUpRequiredAction(action, onComplete);
  }

  return true;
}

function setUpRequiredAction(action: RequiredAction, onComplete: (value: RequiredAction) => void) {
  return new Promise((resolve) => {
    const { target } = action;

    const handleComplete = () => {
      onComplete(action);
      resolve(true);
    };

    waitForElement<HTMLElement>(target).then((targetElement) => {
      if (isClickAction(action)) {
        setupClickAction(targetElement, handleComplete);
      }

      if (isChangeAction(action)) {
        setupChangeAction(targetElement, action, handleComplete);

        requestAnimationFrame(() => {
          targetElement.focus();
        });
      }

      if (isInputAction(action)) {
        setupInputAction(targetElement, action, handleComplete);

        requestAnimationFrame(() => {
          targetElement.focus();
        });
      }
    });
  });
}

function setupClickAction(targetElement: Element, onComplete: (value: unknown) => void) {
  const removeOnComplete = () => {
    targetElement.removeEventListener('click', handleOnComplete);
  };
  document.addEventListener(TUTORIAL_EXIT_EVENT, removeOnComplete);

  const handleOnComplete = () => {
    onComplete(true);
    document.removeEventListener(TUTORIAL_EXIT_EVENT, removeOnComplete);
  };

  targetElement.addEventListener('click', handleOnComplete, { once: true });
}

function setupChangeAction(targetElement: HTMLElement, action: ChangeAction, onComplete: (value: unknown) => void) {
  const observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      const newValue = targetElement.getAttribute(action.attribute.name);
      const isCorrectAttribute = mutation.attributeName === action.attribute.name;
      const isCorrectValue = checkCorrectValue(newValue, action.attribute);

      if (mutation.type === 'attributes' && isCorrectAttribute && isCorrectValue) {
        onComplete(newValue);
        observer.disconnect();
        document.removeEventListener(TUTORIAL_EXIT_EVENT, observer.disconnect.bind(observer));
        return;
      }
    }
  });

  observer.observe(targetElement, { attributes: true, attributeFilter: [action.attribute.name] });
  document.addEventListener(TUTORIAL_EXIT_EVENT, observer.disconnect.bind(observer));
}

function setupInputAction(targetElement: HTMLElement, action: InputAction, onComplete: (value: unknown) => void) {
  const removeOnComplete = () => {
    targetElement.removeEventListener('input', listener);
  };
  document.addEventListener(TUTORIAL_EXIT_EVENT, removeOnComplete);
  const debouncedInput = debounce((e) => {
    if (checkRegEx(e.target?.value, action.regEx)) {
      onComplete(true);
      document.removeEventListener(TUTORIAL_EXIT_EVENT, removeOnComplete);
    }
  }, 500); // 300ms delay

  // @ts-expect-error
  const listener = (e) => {
    debouncedInput(e);
  };

  targetElement.addEventListener('input', listener);
}

export function isClickAction(action: RequiredAction): action is ClickAction {
  return action.action === 'click';
}

export function isChangeAction(action: RequiredAction): action is ChangeAction {
  return action.action === 'change';
}

export function isInputAction(action: RequiredAction): action is InputAction {
  return action.action === 'input';
}

export function checkCorrectValue(valueProvided: string | null | undefined, attribute: Attribute) {
  if (!valueProvided) {
    return false;
  }

  if (isStringAttribute(attribute)) {
    return valueProvided === attribute.value;
  }

  if (isRegexAttribute(attribute)) {
    return checkRegEx(valueProvided, attribute.regEx);
  }

  return false;
}

function checkRegEx(value: string, regEx: string) {
  const regexString = regEx;
  const pattern = regexString.slice(1, regexString.lastIndexOf('/'));
  const flags = regexString.slice(regexString.lastIndexOf('/') + 1);
  const regex = new RegExp(pattern, flags);

  return regex.test(value);
}

export function isRegexAttribute(attribute: Attribute): attribute is RegExpAttribute {
  return attribute.hasOwnProperty('regEx');
}

export function isStringAttribute(attribute: Attribute): attribute is StringAttribute {
  return attribute.hasOwnProperty('value');
}

// export function getElementByXpath(path: string) {
//   const reactRoot = document.getElementById('reactRoot') as Element;
//   return document.evaluate(path, reactRoot, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
// }

export function isElementVisible(element: Element) {
  const { width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0;
}
