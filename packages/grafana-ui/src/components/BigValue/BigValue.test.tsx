import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';

import { BigValue, BigValueColorMode, BigValueGraphMode, Props } from './BigValue';

const valueObject = {
  text: '25',
  numeric: 25,
  color: 'red',
};

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    colorMode: BigValueColorMode.Background,
    graphMode: BigValueGraphMode.Line,
    height: 300,
    width: 300,
    value: valueObject,
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

    it('should render with percent change', () => {
      render(
        <BigValue
          {...getProps({
            value: { ...valueObject, percentChange: 0.5 },
          })}
        />
      );

      expect(screen.getByText('0.5%')).toBeInTheDocument();
    });

    it('should render without percent change', () => {
      render(<BigValue {...getProps()} />);
      expect(screen.queryByText('%')).not.toBeInTheDocument();
    });
  });
});
