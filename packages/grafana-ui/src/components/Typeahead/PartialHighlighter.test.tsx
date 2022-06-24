import { render, screen } from '@testing-library/react';
import React from 'react';

import { PartialHighlighter } from './PartialHighlighter';

function assertPart(text: string, isHighlighted: boolean): void {
  const element = screen.getByText(text);
  expect(element).toBeInTheDocument();
  if (isHighlighted) {
    expect(element).toHaveClass('highlight');
  } else {
    expect(element).not.toHaveClass('highlight');
  }
}

describe('PartialHighlighter component', () => {
  it('should highlight inner parts correctly', () => {
    render(
      <PartialHighlighter
        text="Lorem ipsum dolor sit amet"
        highlightClassName="highlight"
        highlightParts={[
          { start: 6, end: 10 },
          { start: 18, end: 20 },
        ]}
      />
    );

    assertPart('Lorem', false);
    assertPart('ipsum', true);
    assertPart('dolor', false);
    assertPart('sit', true);
    assertPart('amet', false);
  });

  it('should highlight outer parts correctly', () => {
    render(
      <PartialHighlighter
        text="Lorem ipsum dolor sit amet"
        highlightClassName="highlight"
        highlightParts={[
          { start: 0, end: 4 },
          { start: 22, end: 25 },
        ]}
      />
    );
    assertPart('Lorem', true);
    assertPart('ipsum dolor sit', false);
    assertPart('amet', true);
  });

  it('renders nothing if highlightParts is empty', () => {
    render(<PartialHighlighter text="Lorem ipsum dolor sit amet" highlightClassName="highlight" highlightParts={[]} />);
    expect(screen.queryByText('Lorem')).not.toBeInTheDocument();
    expect(screen.queryByText('ipsum')).not.toBeInTheDocument();
    expect(screen.queryByText('dolor')).not.toBeInTheDocument();
    expect(screen.queryByText('sit')).not.toBeInTheDocument();
    expect(screen.queryByText('amet')).not.toBeInTheDocument();
  });
});
