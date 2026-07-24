import { render } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { type CanvasElementOptions } from '../../element';
import { createMockDimensionContext } from '../testHelpers';

import { serverItem } from './server';

const ServerDisplay = serverItem.display;

// ServerType/ServerConfig/ServerData are not exported; the display only reads data.type, so
// loose typing keyed by the string value is enough for these render smoke tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serverData = (type: string): any => ({ type });

describe('serverItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('applies defaults when config is empty', () => {
      const ctx = createMockDimensionContext();
      const data = serverItem.prepareData!(ctx, {
        name: 'el',
        type: 'server',
        config: undefined,
      } as CanvasElementOptions);

      expect(data.blinkRate).toBe(0);
      expect(data.statusColor).toBe('transparent');
      expect(data.bulbColor).toBe('green');
      expect(data.type).toBe('Single');
      expect(ctx.getScalar).not.toHaveBeenCalled();
      expect(ctx.getColor).not.toHaveBeenCalled();
    });

    it('resolves blink rate and colors from the dimension context', () => {
      const ctx = createMockDimensionContext({ scalar: 5, color: '#ff0000' });
      const data = serverItem.prepareData!(ctx, {
        name: 'el',
        type: 'server',
        config: {
          type: 'Stack' as never,
          blinkRate: { fixed: 5, min: 0, max: 100 },
          statusColor: { fixed: '#ff0000' },
          bulbColor: { fixed: '#ff0000' },
        },
      });

      expect(data.blinkRate).toBe(5);
      expect(data.statusColor).toBe('#ff0000');
      expect(data.bulbColor).toBe('#ff0000');
      expect(data.type).toBe('Stack');
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with the Single type, empty links and zero rotation', () => {
      const options = serverItem.getNewOptions();

      expect(options.config?.type).toBe('Single');
      expect(options.background?.color?.fixed).toBe('transparent');
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it.each(['Single', 'Stack', 'Database', 'Terminal'])('renders the %s sub-component', (type) => {
      const { container } = render(<ServerDisplay config={serverData(type)} data={serverData(type)} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.querySelector('path')).toBeInTheDocument();
    });

    it('renders nothing when data is undefined', () => {
      const { container } = render(<ServerDisplay config={serverData('Single')} data={undefined} />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
