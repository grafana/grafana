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
  it('truncates when it has not enough space and truncate prop is set to true', () => {
    render(
      <div style={{ width: '50px' }}>
        <Text as={'h1'} truncate={true}>
          This is a text component
        </Text>
      </div>
    );
    const textComponent = screen.getByRole('heading');
    expect(textComponent).toHaveStyle('overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap');
  });
  it('does not truncate when truncate prop is set to false although it has not enough space', () => {
    render(
      <div style={{ width: '50px' }}>
        <Text as={'h1'} truncate={false}>
          This is a text component
        </Text>
      </div>
    );
    const textComponent = screen.getByRole('heading');
    expect(textComponent).not.toHaveStyle('overflow: hidden');
    expect(textComponent).not.toHaveStyle('textOverflow: ellipsis');
    expect(textComponent).not.toHaveStyle('whiteSpace: nowrap');
  });
});
