import { render, screen } from '@testing-library/react';
import React from 'react';

import { createTheme } from '@grafana/data';

import { BigValue, BigValueColorMode, BigValueGraphMode, Props } from './BigValue';

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    colorMode: BigValueColorMode.Background,
    graphMode: BigValueGraphMode.Line,
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
      color: 'red',
    },
    theme: createTheme(),
  };

  Object.assign(props, propOverrides);
  return props;
}

describe('BigValue', () => {
  describe('Render with basic options', () => {
    it('should render', () => {
      render(<BigValue {...getProps()} />);

      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });
});
