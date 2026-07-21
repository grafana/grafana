import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createTheme, EventBusSrv } from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { mockThemeContext, PanelContextProvider } from '@grafana/ui';

import { type CanvasElementOptions } from '../element';
import { Align, type TextConfig, type TextData, VAlign } from '../types';

import { createMockDimensionContext } from './testHelpers';
import { textItem } from './text';

const TextDisplay = textItem.display;

const renderDisplay = (props: { config: TextConfig; data?: TextData; isSelected?: boolean }) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <PanelContextProvider value={{ eventsScope: 'test', eventBus: new EventBusSrv() }}>{children}</PanelContextProvider>
  );
  return render(<TextDisplay {...props} />, { wrapper: Wrapper });
};

const baseConfig: TextConfig = {
  align: Align.Center,
  valign: VAlign.Middle,
};

const baseData: TextData = {
  align: Align.Center,
  valign: VAlign.Middle,
};

describe('textItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('resolves text and applies configured alignment', () => {
      const ctx = createMockDimensionContext({ text: 'resolved' });
      const options: CanvasElementOptions<TextConfig> = {
        name: 'el',
        type: 'text',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'resolved' },
          align: Align.Right,
          valign: VAlign.Bottom,
          size: 12,
        },
      };

      const data = textItem.prepareData!(ctx, options);

      expect(data.text).toBe('resolved');
      expect(data.align).toBe(Align.Right);
      expect(data.valign).toBe(VAlign.Bottom);
      expect(ctx.getText).toHaveBeenCalledTimes(1);
    });

    it('defaults align/valign and skips getters when config is empty', () => {
      const ctx = createMockDimensionContext();
      const data = textItem.prepareData!(ctx, { name: 'el', type: 'text', config: undefined });

      expect(data.text).toBe('');
      expect(data.align).toBe(Align.Center);
      expect(data.valign).toBe(VAlign.Middle);
      expect(data.color).toBeUndefined();
      expect(ctx.getText).not.toHaveBeenCalled();
      expect(ctx.getColor).not.toHaveBeenCalled();
    });

    it('resolves color when config.color is present', () => {
      const ctx = createMockDimensionContext({ color: '#123456' });
      const data = textItem.prepareData!(ctx, {
        name: 'el',
        type: 'text',
        config: { align: Align.Center, valign: VAlign.Middle, color: { fixed: '#123456' } },
      });

      expect(data.color).toBe('#123456');
      expect(ctx.getColor).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = textItem.getNewOptions();

      expect(options.config?.align).toBe(Align.Center);
      expect(options.config?.valign).toBe(VAlign.Middle);
      expect(options.config?.size).toBe(16);
      expect(options.placement?.width).toBe(100);
      expect(options.placement?.height).toBe(100);
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });

    it('honors placement overrides', () => {
      const options = textItem.getNewOptions({
        name: 'el',
        type: 'text',
        placement: { width: 20, height: 30, rotation: 45 },
      });

      expect(options.placement?.width).toBe(20);
      expect(options.placement?.height).toBe(30);
      expect(options.placement?.rotation).toBe(45);
    });
  });

  describe('display', () => {
    it('renders the resolved text value', () => {
      renderDisplay({ config: baseConfig, data: { ...baseData, text: 'Hello' } });
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('renders the placeholder when there is no text', () => {
      renderDisplay({ config: baseConfig, data: { ...baseData, text: '' } });
      expect(screen.getByText('Double click to set text')).toBeInTheDocument();
    });
  });
});
