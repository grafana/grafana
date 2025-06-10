import { createElement } from 'react';

import { HighlightPart } from '../../types/completion';

interface Props {
  text: string;
  highlightParts: HighlightPart[];
  highlightClassName: string;
}

/**
 * Flattens parts into a list of indices pointing to the index where a part
 * (highlighted or not highlighted) starts. Adds extra indices if needed
 * at the beginning or the end to ensure the entire text is covered.
 */
function getStartIndices(parts: HighlightPart[], length: number): number[] {
  const indices: number[] = [];
  parts.forEach((part) => {
    indices.push(part.start, part.end + 1);
  });
  if (indices[0] !== 0) {
    indices.unshift(0);
  }
  if (indices[indices.length - 1] !== length) {
    indices.push(length);
  }
  return indices;
}

export const PartialHighlighter = (props: Props) => {
  let { highlightParts, text, highlightClassName } = props;

  if (!highlightParts?.length) {
    return null;
  }

  let children = [];
  let indices = getStartIndices(highlightParts, text.length);
  let highlighted = highlightParts[0].start === 0;

  for (let i = 1; i < indices.length; i++) {
    let start = indices[i - 1];
    let end = indices[i];

    children.push(
      createElement(
        highlighted ? 'mark' : 'span',
        {
          key: i - 1,
          className: highlighted ? highlightClassName : undefined,
        },
        text.substring(start, end)
      )
    );
    highlighted = !highlighted;
  }

  return <div>{children}</div>;
};
