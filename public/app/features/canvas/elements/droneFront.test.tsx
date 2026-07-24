import { render } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { type CanvasElementOptions } from '../element';

import { droneFrontItem } from './droneFront';
import { createMockDimensionContext } from './testHelpers';

const DroneFrontDisplay = droneFrontItem.display;

describe('droneFrontItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('resolves the roll angle from the scalar dimension', () => {
      const ctx = createMockDimensionContext({ scalar: 30 });
      const data = droneFrontItem.prepareData!(ctx, {
        name: 'el',
        type: 'droneFront',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { rollAngle: { fixed: 30, min: 0, max: 360 } } as any,
      });

      expect(data.rollAngle).toBe(30);
      expect(ctx.getScalar).toHaveBeenCalledTimes(1);
    });

    it('defaults the roll angle to 0 when absent', () => {
      const ctx = createMockDimensionContext();
      const data = droneFrontItem.prepareData!(ctx, {
        name: 'el',
        type: 'droneFront',
        config: undefined,
      } as CanvasElementOptions);

      expect(data.rollAngle).toBe(0);
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = droneFrontItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe('transparent');
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the drone front svg', () => {
      const { container } = render(<DroneFrontDisplay config={{}} data={{ rollAngle: 0 }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
