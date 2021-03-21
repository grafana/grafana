import React from 'react';
import { HighlightPart } from '../../types';

interface Props {
  text: string;
  highlightParts: HighlightPart[];
  highlightClassName: string;
}

export const PartialHighlighter: React.FC<Props> = (props: Props) => {
  let { highlightParts, text, highlightClassName } = props;

  let children = [];

  const firstRange = highlightParts[0];

  if (firstRange.start !== 0) {
    children.push(<span key={children.length}>{text.substring(0, firstRange.start)}</span>);
  }

  for (let i = 0; i < highlightParts.length - 1; i++) {
    let range = highlightParts[i],
      nextRange = highlightParts[i + 1];
    children.push(
      <mark key={children.length} className={highlightClassName}>
        {text.substring(range.start, range.end + 1)}
      </mark>
    );
    children.push(<span key={children.length}>{text.substring(range.end + 1, nextRange.start)}</span>);
  }

  let lastRange = highlightParts[highlightParts.length - 1];

  children.push(
    <mark key={children.length} className={highlightClassName}>
      {text.substring(lastRange.start, lastRange.end + 1)}
    </mark>
  );

  if (lastRange.end + 1 < text.length) {
    children.push(<span key={children.length}>{text.substring(lastRange.end + 1, text.length)}</span>);
  }

  return <div>{children}</div>;
};
