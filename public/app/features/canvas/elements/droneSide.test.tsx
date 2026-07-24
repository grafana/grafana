import { render } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { type CanvasElementOptions } from '../element';

import { droneSideItem } from './droneSide';
import { createMockDimensionContext } from './testHelpers';

const DroneSideDisplay = droneSideItem.display;

describe('droneSideItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('resolves the pitch angle from the scalar dimension', () => {
      const ctx = createMockDimensionContext({ scalar: 15 });
      const data = droneSideItem.prepareData!(ctx, {
        name: 'el',
        type: 'droneSide',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { pitchAngle: { fixed: 15, min: 0, max: 360 } } as any,
      });

      expect(data.pitchAngle).toBe(15);
      expect(ctx.getScalar).toHaveBeenCalledTimes(1);
    });

    it('defaults the pitch angle to 0 when absent', () => {
      const ctx = createMockDimensionContext();
      const data = droneSideItem.prepareData!(ctx, {
        name: 'el',
        type: 'droneSide',
        config: undefined,
      } as CanvasElementOptions);

      expect(data.pitchAngle).toBe(0);
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = droneSideItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe('transparent');
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the drone side svg', () => {
      const { container } = render(<DroneSideDisplay config={{}} data={{ pitchAngle: 0 }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
