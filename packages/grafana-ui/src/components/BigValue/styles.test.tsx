import React from 'react';
import { shallow } from 'enzyme';
import { DisplayValue } from '@grafana/data';
import { BigValue, Props, BigValueColorMode, BigValueGraphMode } from './BigValue';
import { calculateLayout, LayoutType } from './styles';
import { VizOrientation } from '@grafana/data';
import { getTheme } from '../../themes';

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    maxValue: 100,
    minValue: 0,
    colorMode: BigValueColorMode.Background,
    graphMode: BigValueColorMode.Line,
    thresholds: [{ value: -Infinity, color: 'green' }],
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
    },
    sparkline: {
      data: [
        [10, 10],
        [10, 10],
      ],
      minX: 0,
      maxX: 100,
    },
    theme: getTheme(),
    orientation: VizOrientation.Horizontal,
  };

  Object.assign(props, propOverrides);
  return props;
}

// function getValue(value: number, title?: string): DisplayValue {
//   return { numeric: value, text: value.toString(), title: title };
// }

describe('BigValue styles', () => {
  describe('calculateLayout', () => {
    it('should auto select to stacked layout', () => {
      const layout = calculateLayout(
        getProps({
          width: 300,
          height: 300,
        })
      );
      expect(layout.type).toBe(LayoutType.Stacked);
    });

    it('should auto select to wide layout', () => {
      const layout = calculateLayout(
        getProps({
          wide: 300,
          height: 100,
        })
      );
      expect(layout.type).toBe(LayoutType.Wide);
    });
  });
});
