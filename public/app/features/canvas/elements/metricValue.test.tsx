import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { of } from 'rxjs';

import { createTheme, EventBusSrv, toDataFrame } from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { mockThemeContext, PanelContextProvider } from '@grafana/ui';

import { type CanvasElementOptions } from '../element';
import { Align, type TextConfig, type TextData, VAlign } from '../types';

import { metricValueItem } from './metricValue';
import { createMockDimensionContext } from './testHelpers';

const MetricValueDisplay = metricValueItem.display;

/** Renders the display component inside a PanelContextProvider so usePanelContext() does not throw. */
const renderDisplay = (
  props: { config: TextConfig; data?: TextData; isSelected?: boolean },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instanceState?: any
) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <PanelContextProvider value={{ eventsScope: 'test', eventBus: new EventBusSrv(), instanceState }}>
      {children}
    </PanelContextProvider>
  );
  return render(<MetricValueDisplay {...props} />, { wrapper: Wrapper });
};

const baseConfig: TextConfig = {
  align: Align.Center,
  valign: VAlign.Middle,
};

const baseData: TextData = {
  align: Align.Center,
  valign: VAlign.Middle,
};

describe('metricValueItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('resolves text from the dimension context and applies alignment', () => {
      const ctx = createMockDimensionContext({ text: 'resolved' });
      const options: CanvasElementOptions<TextConfig> = {
        name: 'el',
        type: 'metric-value',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'resolved' },
          align: Align.Left,
          valign: VAlign.Top,
          size: 24,
        },
      };

      const data = metricValueItem.prepareData!(ctx, options);

      expect(data.text).toBe('resolved');
      expect(data.align).toBe(Align.Left);
      expect(data.valign).toBe(VAlign.Top);
      expect(data.size).toBe(24);
      expect(ctx.getText).toHaveBeenCalledTimes(1);
    });

    it('defaults align/valign and skips the color getter when config is empty', () => {
      const ctx = createMockDimensionContext();
      const options: CanvasElementOptions<TextConfig> = {
        name: 'el',
        type: 'metric-value',
        config: undefined,
      };

      const data = metricValueItem.prepareData!(ctx, options);

      expect(data.text).toBe('');
      expect(data.align).toBe(Align.Center);
      expect(data.valign).toBe(VAlign.Middle);
      expect(data.color).toBeUndefined();
      expect(ctx.getText).not.toHaveBeenCalled();
      expect(ctx.getColor).not.toHaveBeenCalled();
    });

    it('resolves color only when config.color is present', () => {
      const ctx = createMockDimensionContext({ color: '#abcdef' });
      const options: CanvasElementOptions<TextConfig> = {
        name: 'el',
        type: 'metric-value',
        config: { align: Align.Center, valign: VAlign.Middle, color: { fixed: '#abcdef' } },
      };

      const data = metricValueItem.prepareData!(ctx, options);

      expect(data.color).toBe('#abcdef');
      expect(ctx.getColor).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = metricValueItem.getNewOptions();

      expect(options.config?.align).toBe(Align.Center);
      expect(options.config?.valign).toBe(VAlign.Middle);
      expect(options.config?.size).toBe(20);
      expect(options.background?.color?.fixed).toBeDefined();
      expect(options.placement?.top).toBe(100);
      expect(options.placement?.left).toBe(100);
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });

    it('honors placement overrides', () => {
      const options = metricValueItem.getNewOptions({
        name: 'el',
        type: 'metric-value',
        placement: { top: 5, left: 7, rotation: 90 },
      });

      expect(options.placement?.top).toBe(5);
      expect(options.placement?.left).toBe(7);
      expect(options.placement?.rotation).toBe(90);
    });
  });

  describe('display', () => {
    it('renders the resolved value', () => {
      renderDisplay({ config: baseConfig, data: { ...baseData, text: '42' } });
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('shows the placeholder when there is no value and no panel data', () => {
      renderDisplay({ config: baseConfig, data: { ...baseData, text: '' } });
      expect(screen.getByText('Double click to set field')).toBeInTheDocument();
    });

    it('shows "No data" when the field exists but resolves to nothing', () => {
      const series = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];
      const config: TextConfig = { ...baseConfig, text: { mode: TextDimensionMode.Field, fixed: '', field: 'a' } };
      renderDisplay(
        { config, data: { ...baseData, text: '' } },
        { scene: { data: { series }, editModeEnabled: of(false) } }
      );
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('shows "Field not found" when the configured field is missing from the data', () => {
      const series = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];
      const config: TextConfig = {
        ...baseConfig,
        text: { mode: TextDimensionMode.Field, fixed: '', field: 'missing' },
      };
      renderDisplay(
        { config, data: { ...baseData, text: '' } },
        { scene: { data: { series }, editModeEnabled: of(false) } }
      );
      expect(screen.getByText('Field not found')).toBeInTheDocument();
    });
  });
});
