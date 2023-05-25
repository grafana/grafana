import { createTheme, FieldType } from '@grafana/data';

import { Props, BigValueColorMode, BigValueGraphMode, BigValueTextMode } from './BigValue';
import { buildLayout, StackedWithChartLayout, StackedWithNoChartLayout, WideWithChartLayout } from './BigValueLayout';

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    colorMode: BigValueColorMode.Background,
    graphMode: BigValueGraphMode.Area,
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
    },
    sparkline: {
      y: {
        name: '',
        values: [1, 2, 3, 4, 3],
        type: FieldType.number,
        config: {},
      },
    },
    count: 1,
    theme: createTheme(),
  };

  Object.assign(props, propOverrides);
  return props;
}

describe('BigValueLayout', () => {
  describe('buildLayout', () => {
    it('should auto select to stacked layout', () => {
      const layout = buildLayout(
        getProps({
          width: 300,
          height: 300,
        })
      );
      expect(layout).toBeInstanceOf(StackedWithChartLayout);
    });

    it('should not include title height when count is 1 and title is auto hidden', () => {
      const layout = buildLayout(
        getProps({
          value: {
            text: '25',
            title: '10',
            numeric: 25,
          },
          sparkline: undefined,
          textMode: BigValueTextMode.Auto,
          count: 1,
        })
      );
      expect(layout.titleFontSize).toBe(0);
    });

    it('should not use chart layout if only one sparkline point', () => {
      const layout = buildLayout(
        getProps({
          value: {
            text: '25',
            title: '10',
            numeric: 25,
          },
          sparkline: {
            y: {
              name: '',
              values: [1],
              type: FieldType.number,
              config: {},
            },
          },
        })
      );
      expect(layout).toBeInstanceOf(StackedWithNoChartLayout);
    });

    it('should auto select to wide layout', () => {
      const layout = buildLayout(
        getProps({
          width: 300,
          height: 100,
        })
      );
      expect(layout).toBeInstanceOf(WideWithChartLayout);
    });
  });
});
