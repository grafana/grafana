// import { locationService } from '@grafana/runtime';
import { TUTORIAL_EXIT_EVENT } from './constants';
import type { Attribute, RequiredAction, ClickAction, ChangeAction, StringAttribute, RegExpAttribute } from './types';

export function waitForElement<T extends Element = Element>(selector: string, timeout = 500): Promise<T> {
  console.log(selector);
  return new Promise((resolve, reject) => {
    const resolver = (element: T) =>
      hasElementStoppedAnimating(element).then(() => {
        requestAnimationFrame(() => {
          resolve(element);
        });
      });

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

    const stopWaiting = setTimeout(() => {
      clearInterval(interval);
      clearTimeout(stopWaiting);
      reject(null);
    }, timeout);
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

export async function resolveRequiredActions(requiredActions: RequiredAction[]) {
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

function setupChangeAction(targetElement: Element, action: ChangeAction, onComplete: (value: unknown) => void) {
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

export function isClickAction(action: RequiredAction): action is ClickAction {
  return action.action === 'click';
}

export function isChangeAction(action: RequiredAction): action is ChangeAction {
  return action.action === 'change';
}

export function checkCorrectValue(valueProvided: string | null | undefined, attribute: Attribute) {
  if (!valueProvided) {
    return false;
  }

  if (isStringAttribute(attribute)) {
    return valueProvided === attribute.value;
  }

  if (isRegexAttribute(attribute)) {
    const regexString = '/prom/i';
    const pattern = regexString.slice(1, regexString.lastIndexOf('/'));
    const flags = regexString.slice(regexString.lastIndexOf('/') + 1);
    const regex = new RegExp(pattern, flags);

    return regex.test(valueProvided);
  }

  return false;
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
