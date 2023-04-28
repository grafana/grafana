import { render, screen } from '@testing-library/react';
import React from 'react';

import { createTheme } from '@grafana/data';

import { Text } from './Text';

describe('Text', () => {
  it('renders correctly', () => {
    render(<Text>This is a text component</Text>);
    expect(screen.getByText('This is a text component')).toBeInTheDocument();
  });

  it('has the selected colour', () => {
    const customColor = 'info';
    const theme = createTheme();
    render(<Text color={customColor}>This is a text component</Text>);
    const textComponent = screen.getByRole('heading');
    expect(textComponent).toHaveStyle(`color:${theme.colors.info.text}`);
  });
});
