import { render, screen } from '@testing-library/react';

import { PartialHighlighter } from './PartialHighlighter';

function expectPart(text: string, isHighlighted: boolean): void {
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

    expectPart('Lorem', false);
    expectPart('ipsum', true);
    expectPart('dolor', false);
    expectPart('sit', true);
    expectPart('amet', false);
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
    expectPart('Lorem', true);
    expectPart('ipsum dolor sit', false);
    expectPart('amet', true);
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
