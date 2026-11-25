import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

/**
 * Replaces elements in a React node, at any depth, such as buttons inside a Stack or a fragment. `replace` returns the
 * element to render in place of an element, or `undefined` to keep the element and look inside its children. A
 * component that renders an element itself can't be reached, because only the elements passed in are visible here.
 */
export const mapElements = (
  node: ReactNode,
  replace: (element: ReactElement<unknown>) => ReactNode | undefined
): ReactNode =>
  Children.map(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return child;
    }

    const replacement = replace(child);
    if (replacement !== undefined) {
      return replacement;
    }

    // Children.map drops a render function, so leave elements that take one unchanged.
    const nestedChildren = child.props.children;
    if (nestedChildren === undefined || typeof nestedChildren === 'function') {
      return child;
    }

    return cloneElement(child, undefined, mapElements(nestedChildren, replace));
  });
