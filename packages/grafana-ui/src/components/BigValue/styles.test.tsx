import { Props, BigValueColorMode, BigValueGraphMode } from './BigValue';
import { calculateLayout, LayoutType } from './styles';
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
      minX: 0,
      maxX: 100,
    },
    theme: getTheme(),
  };

  Object.assign(props, propOverrides);
  return props;
}

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
          width: 300,
          height: 100,
        })
      );
      expect(layout.type).toBe(LayoutType.Wide);
    });
  });
});
