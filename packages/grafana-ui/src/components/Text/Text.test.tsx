import { render, screen } from '@testing-library/react';
import React from 'react';

import { createTheme, ThemeTypographyVariantTypes } from '@grafana/data';

import { Text } from './Text';

describe('Text', () => {
  it('renders correctly', () => {
    render(<Text as={'h1'}>This is a text component</Text>);
    expect(screen.getByText('This is a text component')).toBeInTheDocument();
  });
  it('keeps the element type but changes its styles', () => {
    const customVariant: keyof ThemeTypographyVariantTypes = 'body';
    render(
      <Text as={'h1'} variant={customVariant}>
        This is a text component
      </Text>
    );
    const theme = createTheme();
    const textComponent = screen.getByRole('heading');
    expect(textComponent).toBeInTheDocument();
    expect(textComponent).toHaveStyle(`fontSize: ${theme.typography.body.fontSize}`);
  });
  it('has the selected colour', () => {
    const customColor = 'info';
    const theme = createTheme();
    render(
      <Text as={'h1'} color={customColor}>
        This is a text component
      </Text>
    );
    const textComponent = screen.getByRole('heading');
    expect(textComponent).toHaveStyle(`color:${theme.colors.info.text}`);
  });
});
