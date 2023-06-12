import { Record } from 'immutable';
import React from 'react';
import { Mark, Node, Decoration } from 'slate';
import { Editor } from 'slate-react';

import TOKEN_MARK from './TOKEN_MARK';

export interface OptionsFormat {
  // Determine which node should be highlighted
  onlyIn?: (node: Node) => boolean;
  // Returns the syntax for a node that should be highlighted
  getSyntax?: (node: Node) => string;
  // Render a highlighting mark in a highlighted node
  renderMark?: ({ mark, children }: { mark: Mark; children: React.ReactNode }) => void | React.ReactNode;
}

/**
 * Default filter for code blocks
 */
function defaultOnlyIn(node: Node): boolean {
  return node.object === 'block' && node.type === 'code_block';
}

/**
 * Default getter for syntax
 */
function defaultGetSyntax(node: Node): string {
  return 'javascript';
}

/**
 * Default rendering for decorations
 */
function defaultRenderDecoration(
  props: { children: React.ReactNode; decoration: Decoration },
  editor: Editor,
  next: () => any
): void | React.ReactNode {
  const { decoration } = props;
  if (decoration.type !== TOKEN_MARK) {
    return next();
  }

  const className = decoration.data.get('className');
  return <span className={className}>{props.children}</span>;
}

/**
 * The plugin options
 */
class Options
  extends Record({
    onlyIn: defaultOnlyIn,
    getSyntax: defaultGetSyntax,
    renderDecoration: defaultRenderDecoration,
  })
  implements OptionsFormat
{
  declare readonly onlyIn: (node: Node) => boolean;
  declare readonly getSyntax: (node: Node) => string;
  declare readonly renderDecoration: (
    {
      decoration,
      children,
    }: {
      decoration: Decoration;
      children: React.ReactNode;
    },
    editor: Editor,
    next: () => any
  ) => void | React.ReactNode;

  constructor(props: OptionsFormat) {
    super(props);
  }
}

export default Options;
