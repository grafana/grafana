import { render } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { type CanvasElementOptions } from '../element';

import { droneTopItem } from './droneTop';
import { createMockDimensionContext } from './testHelpers';

const DroneTopDisplay = droneTopItem.display;

const ROTOR_KEYS = ['bRightRotorRPM', 'bLeftRotorRPM', 'fRightRotorRPM', 'fLeftRotorRPM', 'yawAngle'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scalarConfig = (): any =>
  ROTOR_KEYS.reduce((acc, key) => ({ ...acc, [key]: { fixed: 7, min: 0, max: 100 } }), {});

describe('droneTopItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('resolves all five scalars', () => {
      const ctx = createMockDimensionContext({ scalar: 7 });
      const data = droneTopItem.prepareData!(ctx, { name: 'el', type: 'droneTop', config: scalarConfig() });

      for (const key of ROTOR_KEYS) {
        expect(data[key]).toBe(7);
      }
      expect(ctx.getScalar).toHaveBeenCalledTimes(5);
    });

    it('defaults every scalar to 0 when config is empty', () => {
      const ctx = createMockDimensionContext();
      const data = droneTopItem.prepareData!(ctx, {
        name: 'el',
        type: 'droneTop',
        config: undefined,
      } as CanvasElementOptions);

      for (const key of ROTOR_KEYS) {
        expect(data[key]).toBe(0);
      }
      expect(ctx.getScalar).not.toHaveBeenCalled();
    });

    it('resolves each scalar independently', () => {
      const ctx = createMockDimensionContext({ scalar: 9 });
      const data = droneTopItem.prepareData!(ctx, {
        name: 'el',
        type: 'droneTop',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { yawAngle: { fixed: 9, min: 0, max: 360 } } as any,
      });

      expect(data.yawAngle).toBe(9);
      expect(data.bRightRotorRPM).toBe(0);
      expect(data.bLeftRotorRPM).toBe(0);
      expect(data.fRightRotorRPM).toBe(0);
      expect(data.fLeftRotorRPM).toBe(0);
      expect(ctx.getScalar).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNewOptions', () => {
    it('produces valid options with empty links despite omitting a placement block', () => {
      const options = droneTopItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe('transparent');
      expect(options.links).toEqual([]);
      expect(options.placement).toBeUndefined();
    });
  });

  describe('display', () => {
    it('renders the drone top svg', () => {
      const { container } = render(<DroneTopDisplay config={{}} data={{ yawAngle: 0 }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
