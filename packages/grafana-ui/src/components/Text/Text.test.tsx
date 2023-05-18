import { render, screen } from '@testing-library/react';
import React from 'react';

import { createTheme } from '@grafana/data';

import { Text } from './Text';
import { H2 } from './TextElements';

describe('Text', () => {
  it('renders correctly', () => {
    render(<Text>This is a text component</Text>);
    expect(screen.getByText('This is a text component')).toBeInTheDocument();
  });

  it('styles text with variants', () => {
    render(<Text variant="body">This is a text component</Text>);
    const theme = createTheme();
    const textComponent = screen.getByText('This is a text component');
    expect(textComponent).toHaveStyle({ fontSize: theme.typography.body.fontSize });
  });

  it('has the selected colour', () => {
    render(<Text color="secondary">This is a text component</Text>);
    const theme = createTheme();
    const textComponent = screen.getByText('This is a text component');
    expect(textComponent).toHaveStyle({ color: theme.colors.text.secondary });
  });
});

describe('TextElements', () => {
  it('renders headings correctly', () => {
    render(<H2 variant="h1">Hello, world</H2>);
    const theme = createTheme();
    const heading = screen.getByRole('heading');
    expect(heading.tagName).toBe('H2');
    expect(heading).toHaveStyle({ fontSize: theme.typography.h1.fontSize });
  });
});
