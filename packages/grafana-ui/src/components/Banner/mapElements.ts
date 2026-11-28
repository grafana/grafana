import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

// Whether React can render a node as it is. Some components take children that React can't render, and handle them
// themselves, such as a render function, or the interpolation objects in Trans. Children.map throws on an object.
const isRenderable = (node: unknown): boolean => {
  if (node === null || node === undefined || ['boolean', 'string', 'number', 'bigint'].includes(typeof node)) {
    return true;
  }

  if (Array.isArray(node)) {
    return node.every(isRenderable);
  }

  return isValidElement(node);
};

/**
 * Replaces elements in a React node, at any depth, such as buttons inside a Stack or a fragment. `replace` returns the
 * element to render in place of an element, or `undefined` to keep the element and look inside its children. A
 * component that renders an element itself can't be reached, because only the elements passed in are visible here.
 *
 * The result has the shape of the node: a single child stays a single child. Children.map always returns an array, and
 * some components, such as Tooltip, need their one child as an element.
 */
export const mapElements = (
  node: ReactNode,
  replace: (element: ReactElement<unknown>) => ReactNode | undefined
): ReactNode => {
  const mapped = mapEachChild(node, replace);

  return !Array.isArray(node) && Array.isArray(mapped) && mapped.length === 1 ? mapped[0] : mapped;
};

const mapEachChild = (node: ReactNode, replace: (element: ReactElement<unknown>) => ReactNode | undefined) =>
  Children.map(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return child;
    }

    const replacement = replace(child);
    if (replacement !== undefined) {
      return replacement;
    }

    // Leave an element unchanged when its children aren't renderable as they are, because its component handles them.
    const nestedChildren = child.props.children;
    if (nestedChildren === undefined || !isRenderable(nestedChildren)) {
      return child;
    }

    return cloneElement(child, undefined, mapElements(nestedChildren, replace));
  });
