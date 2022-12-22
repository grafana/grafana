import { screen, render } from '@testing-library/react';
import React from 'react';

import { createTheme } from '@grafana/data';

import { NamedColorsPalette } from './NamedColorsPalette';

describe('NamedColorsPalette', () => {
  const theme = createTheme();
  const greenHue = theme.visualization.hues.find((x) => x.name === 'green')!;
  const selectedShade = greenHue.shades[2];

  describe('theme support for named colors', () => {
    it('should render provided color variant specific for theme', () => {
      render(<NamedColorsPalette color={selectedShade.name} onChange={jest.fn()} />);
      expect(screen.getByRole('button', { name: `${selectedShade.name} color` })).toBeInTheDocument();
    });
  });
});
