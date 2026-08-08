import { render, screen } from '@testing-library/react';

import { ResourceDimensionMode, TextDimensionMode } from '@grafana/schema';

import { type CanvasElementOptions, defaultBgColor } from '../element';
import { Align, type CanvasElementConfig, type CanvasElementData, VAlign } from '../types';

import { ellipseItem } from './ellipse';
import { createMockDimensionContext } from './testHelpers';

const EllipseDisplay = ellipseItem.display;

const baseData: CanvasElementData = { align: Align.Center, valign: VAlign.Middle };

describe('ellipseItem', () => {
  describe('prepareData', () => {
    it('resolves text, color, background, border and image', () => {
      const ctx = createMockDimensionContext({ text: 'oval', color: '#111111', resource: 'bg.png' });
      const options: CanvasElementOptions<CanvasElementConfig> = {
        name: 'el',
        type: 'ellipse',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'oval' },
          align: Align.Center,
          valign: VAlign.Middle,
          color: { fixed: '#111111' },
        },
        background: { color: { fixed: '#222222' }, image: { mode: ResourceDimensionMode.Fixed, fixed: 'bg.png' } },
        border: { color: { fixed: '#333333' }, width: 4 },
      };

      const data = ellipseItem.prepareData!(ctx, options);

      expect(data.text).toBe('oval');
      expect(data.color).toBe('#111111');
      // background color, border color and background image each resolve from their own config
      expect(data.backgroundColor).toBe('#222222');
      expect(data.borderColor).toBe('#333333');
      expect(data.borderWidth).toBe(4);
      expect(data.backgroundImage).toBe('bg.png');
    });

    it('falls back to defaults when background and border are absent', () => {
      const ctx = createMockDimensionContext();
      const data = ellipseItem.prepareData!(ctx, { name: 'el', type: 'ellipse', config: undefined });

      expect(data.backgroundColor).toBe(defaultBgColor);
      expect(data.borderColor).toBe(defaultBgColor);
      expect(data.borderWidth).toBe(0);
      expect(data.backgroundImage).toBeUndefined();
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = ellipseItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe(defaultBgColor);
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the text inside an ellipse svg', () => {
      const { container } = render(
        <EllipseDisplay config={{ align: Align.Center, valign: VAlign.Middle }} data={{ ...baseData, text: 'oval' }} />
      );
      expect(screen.getByText('oval')).toBeInTheDocument();
      expect(container.querySelector('ellipse')).toBeInTheDocument();
    });
  });
});
