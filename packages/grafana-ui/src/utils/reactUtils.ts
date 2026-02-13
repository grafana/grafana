import { ReactElement } from 'react';
import * as React from 'react';

/** Element shape that may have a ref (React stores ref on element.ref at runtime) */
type ElementWithOptionalRef<T = HTMLElement> = React.ReactElement | { ref?: React.Ref<T> };

/**
 * Extracts the ref from a React element. The ref is stored on element.ref (not in props).
 * React's TypeScript types omit ref from ReactElement, but it exists at runtime.
 */
export function getRefFromElement<T = HTMLElement>(element: ElementWithOptionalRef<T>): React.Ref<T> | undefined {
  return 'ref' in element ? element.ref : undefined;
}

/**
 * Assigns a value to a React ref. Handles both callback refs and object refs.
 * Used when merging refs (e.g. forwarding a ref while also using one internally).
 * React's RefObject has readonly current, but refs from useRef() are mutable at runtime.
 */
export function setRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (ref == null) {
    return;
  }
  if (typeof ref === 'function') {
    ref(value);
  } else {
    // Use Object.assign to update current - avoids readonly assignment on RefObject
    Object.assign(ref, { current: value });
  }
}

/** Returns the ID value of the first, and only, child element  */
export function getChildId(children: ReactElement<Record<string, unknown>>): string | undefined {
  let inputId: unknown;

  // Get the first, and only, child to retrieve form input's id
  const child = React.Children.only(children);

  // Retrieve input's id to apply on the label for correct click interaction
  // For some components (like Select), we want to get the ID from a different prop
  if ('id' in child?.props) {
    inputId = child.props.id;
  } else if ('inputId' in child.props) {
    inputId = child?.props.inputId;
  }

  return typeof inputId === 'string' ? inputId : undefined;
}

/**
 * Given react node or function returns element accordingly
 *
 * @param itemToRender
 * @param props props to be passed to the function if item provided as such
 */
export function renderOrCallToRender<TProps = {}>(
  itemToRender: ((props: TProps) => React.ReactNode) | React.ReactNode,
  props?: TProps
): React.ReactNode {
  if (React.isValidElement(itemToRender) || typeof itemToRender === 'string' || typeof itemToRender === 'number') {
    return itemToRender;
  }

  if (typeof itemToRender === 'function' && props) {
    return itemToRender(props);
  }

  throw new Error(`${itemToRender} is not a React element nor a function that returns React element`);
}
