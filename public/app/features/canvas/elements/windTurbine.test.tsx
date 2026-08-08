import { render } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { type CanvasElementOptions } from '../element';

import { createMockDimensionContext } from './testHelpers';
import { windTurbineItem } from './windTurbine';

const WindTurbineDisplay = windTurbineItem.display;

describe('windTurbineItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('resolves rpm from the scalar dimension', () => {
      const ctx = createMockDimensionContext({ scalar: 42 });
      const data = windTurbineItem.prepareData!(ctx, {
        name: 'el',
        type: 'windTurbine',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { rpm: { fixed: 42, min: 0, max: 100 } } as any,
      });

      expect(data.rpm).toBe(42);
      expect(ctx.getScalar).toHaveBeenCalledTimes(1);
    });

    it('defaults rpm to 0 when absent', () => {
      const ctx = createMockDimensionContext();
      const data = windTurbineItem.prepareData!(ctx, {
        name: 'el',
        type: 'windTurbine',
        config: undefined,
      } as CanvasElementOptions);

      expect(data.rpm).toBe(0);
      expect(ctx.getScalar).not.toHaveBeenCalled();
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = windTurbineItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe('transparent');
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the turbine svg', () => {
      const { container } = render(<WindTurbineDisplay config={{}} data={{ rpm: 10 }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(container.querySelector('[id="blade"]')).toBeInTheDocument();
    });
  });
});
