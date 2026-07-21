import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { mockThemeContext } from '@grafana/ui';

import { type CanvasElementOptions } from '../element';
import { Align, type TextConfig, type TextData, VAlign } from '../types';

import { rectangleItem } from './rectangle';
import { createMockDimensionContext } from './testHelpers';

const RectangleDisplay = rectangleItem.display;

const baseData: TextData = { align: Align.Center, valign: VAlign.Middle };

describe('rectangleItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('prepareData', () => {
    it('resolves text and color', () => {
      const ctx = createMockDimensionContext({ text: 'rect', color: '#00ff00' });
      const options: CanvasElementOptions<TextConfig> = {
        name: 'el',
        type: 'rectangle',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'rect' },
          align: Align.Left,
          valign: VAlign.Top,
          color: { fixed: '#00ff00' },
        },
      };

      const data = rectangleItem.prepareData!(ctx, options);

      expect(data.text).toBe('rect');
      expect(data.color).toBe('#00ff00');
      expect(data.align).toBe(Align.Left);
      expect(data.valign).toBe(VAlign.Top);
    });

    it('defaults alignment and skips getters when config is empty', () => {
      const ctx = createMockDimensionContext();
      const data = rectangleItem.prepareData!(ctx, { name: 'el', type: 'rectangle', config: undefined });

      expect(data.text).toBe('');
      expect(data.align).toBe(Align.Center);
      expect(data.valign).toBe(VAlign.Middle);
      expect(data.color).toBeUndefined();
      expect(ctx.getText).not.toHaveBeenCalled();
      expect(ctx.getColor).not.toHaveBeenCalled();
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with a background color and empty links', () => {
      const options = rectangleItem.getNewOptions();

      expect(options.config?.align).toBe(Align.Center);
      expect(options.config?.valign).toBe(VAlign.Middle);
      expect(options.background?.color?.fixed).toBeDefined();
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the text', () => {
      render(
        <RectangleDisplay config={{ align: Align.Center, valign: VAlign.Middle }} data={{ ...baseData, text: 'box' }} />
      );
      expect(screen.getByText('box')).toBeInTheDocument();
    });
  });
});
