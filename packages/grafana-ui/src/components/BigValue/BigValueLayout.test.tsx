import { Props, BigValueColorMode, BigValueGraphMode } from './BigValue';
import { buildLayout, StackedWithChartLayout, WideWithChartLayout } from './BigValueLayout';
import { getTheme } from '../../themes';

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
      data: [
        [10, 10],
        [10, 10],
      ],
      xMin: 0,
      xMax: 100,
    },
    theme: getTheme(),
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
