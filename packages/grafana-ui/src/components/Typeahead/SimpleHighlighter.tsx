import React from 'react';

interface Props {
  text: string;
  ranges: Array<{ start: number; end: number }>;
  highlightClassName: string;
}

export const SimpleHighlighter: React.FC<Props> = (props: Props) => {
  let { ranges, text, highlightClassName } = props;

  let children = [];

  const firstRange = ranges[0];

  if (firstRange.start !== 0) {
    children.push(<span key={children.length}>{text.substring(0, firstRange.start)}</span>);
  }

  for (let i = 0; i < ranges.length - 1; i++) {
    let range = ranges[i],
      nextRange = ranges[i + 1];
    children.push(
      <mark key={children.length} className={highlightClassName}>
        {text.substring(range.start, range.end + 1)}
      </mark>
    );
    children.push(<span key={children.length}>{text.substring(range.end + 1, nextRange.start)}</span>);
  }

  let lastRange = ranges[ranges.length - 1];

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
