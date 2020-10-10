import React from 'react';
import Prism from 'prismjs';
import { Decoration } from 'slate';
import { Editor } from '@grafana/slate-react';

const TOKEN_MARK = 'prism-token';

export function setPrismTokens(language: string, field: string | number, values: any, alias = 'variable') {
  Prism.languages[language][field] = {
    alias,
    pattern: new RegExp(`(?:^|\\s)(${values.join('|')})(?:$|\\s)`),
  };
}

/**
 * Code-highlighting plugin based on Prism and
 * https://github.com/ianstormtaylor/slate/blob/master/examples/code-highlighting/index.js
 *
 * (Adapted to handle nested grammar definitions.)
 */

export default function PrismPlugin({ definition, language }: { definition: any; language: string }) {
  if (definition) {
    // Don't override exising modified definitions
    Prism.languages[language] = Prism.languages[language] || definition;
  }

  return {
    /**
     * Render a Slate mark with appropriate CSS class names
     *
     * @param {Object} props
     * @return {Element}
     */

    renderDecoration(props: any, editor: Editor, next: () => any): JSX.Element {
      const { children, decoration } = props;
      // Only apply spans to marks identified by this plugin
      if (decoration.type !== TOKEN_MARK) {
        return next();
      }
      const className = `token ${decoration.data.get('types')}`;
      return <span className={className}>{children}</span>;
    },

    /**
     * Decorate code blocks with Prism.js highlighting.
     *
     * @param {Node} node
     * @return {Array}
     */

    decorateNode(node: any, editor: Editor, next: () => any): any[] {
      if (node.type !== 'paragraph') {
        return [];
      }

      const texts = node.getTexts().toArray();
      const tstring = texts.map((t: { text: any }) => t.text).join('\n');
      const grammar = Prism.languages[language];
      const tokens = Prism.tokenize(tstring, grammar);
      const decorations: Decoration[] = [];
      let startText = texts.shift();
      let endText = startText;
      let startOffset = 0;
      let endOffset = 0;
      let start = 0;

      function processToken(token: any, acc?: string) {
        // Accumulate token types down the tree
        const types = `${acc || ''} ${token.type || ''} ${token.alias || ''}`;

        // Add mark for token node
        if (typeof token === 'string' || typeof token.content === 'string') {
          startText = endText;
          startOffset = endOffset;

          const content = typeof token === 'string' ? token : token.content;
          const newlines = content.split('\n').length - 1;
          const length = content.length - newlines;
          const end = start + length;

          let available = startText.text.length - startOffset;
          let remaining = length;

          endOffset = startOffset + remaining;

          while (available < remaining) {
            endText = texts.shift();
            remaining = length - available;
            available = endText.text.length;
            endOffset = remaining;
          }

          // Inject marks from up the tree (acc) as well
          if (typeof token !== 'string' || acc) {
            const range = node.createDecoration({
              anchor: {
                key: startText.key,
                offset: startOffset,
              },
              focus: {
                key: endText.key,
                offset: endOffset,
              },
              type: TOKEN_MARK,
              data: { types },
            });

            decorations.push(range);
          }

          start = end;
        } else if (token.content && token.content.length) {
          // Tokens can be nested
          for (const subToken of token.content) {
            processToken(subToken, types);
          }
        }
      }

      // Process top-level tokens
      for (const token of tokens) {
        processToken(token);
      }

      return decorations;
    },
  };
}
