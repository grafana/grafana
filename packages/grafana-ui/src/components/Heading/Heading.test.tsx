import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';

import { Heading, HeadingElement, HeadingRoot, HeadingSection } from './Heading';

describe('Heading', () => {
  it('increments nested section levels while keeping sibling headings at the same level', () => {
    render(
      <HeadingRoot>
        <Heading variant="h1">Root heading</Heading>
        <HeadingSection>
          <Heading variant="h2">Section heading</Heading>
          <Heading variant="h2">Sibling heading</Heading>
          <HeadingSection>
            <HeadingElement>Nested heading</HeadingElement>
          </HeadingSection>
        </HeadingSection>
      </HeadingRoot>
    );

    expect(screen.getByRole('heading', { name: 'Root heading', level: 1 })).toHaveProperty('tagName', 'H1');
    expect(screen.getByRole('heading', { name: 'Section heading', level: 2 })).toHaveProperty('tagName', 'H2');
    expect(screen.getByRole('heading', { name: 'Sibling heading', level: 2 })).toHaveProperty('tagName', 'H2');
    expect(screen.getByRole('heading', { name: 'Nested heading', level: 3 })).toHaveProperty('tagName', 'H3');
  });

  it('uses the root level for semantics without changing the required visual variant', () => {
    const { rerender } = render(
      <HeadingRoot level={3}>
        <Heading variant="body">Body-styled heading</Heading>
      </HeadingRoot>
    );

    const heading = screen.getByRole('heading', { name: 'Body-styled heading', level: 3 });
    const theme = createTheme();

    expect(heading).toHaveProperty('tagName', 'H3');
    expect(heading).toHaveStyle(`fontSize: ${theme.typography.body.fontSize}`);

    rerender(
      <HeadingRoot level={5}>
        <Heading variant="body">Body-styled heading</Heading>
      </HeadingRoot>
    );

    expect(screen.getByRole('heading', { name: 'Body-styled heading', level: 5 })).toHaveStyle(
      `fontSize: ${theme.typography.body.fontSize}`
    );
  });

  it('uses an aria heading div when section nesting exceeds native heading levels', () => {
    render(
      <HeadingRoot level={6}>
        <HeadingSection>
          <Heading variant="h6">Deep heading</Heading>
        </HeadingSection>
      </HeadingRoot>
    );

    const heading = screen.getByRole('heading', { name: 'Deep heading', level: 7 });

    expect(heading).toHaveProperty('tagName', 'DIV');
    expect(heading).toHaveAttribute('role', 'heading');
    expect(heading).toHaveAttribute('aria-level', '7');
  });
});
