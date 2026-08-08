import { render, screen } from '@testing-library/react';

import { ResourceDimensionMode, TextDimensionMode } from '@grafana/schema';

import { type CanvasElementOptions, defaultBgColor } from '../element';
import { Align, type CanvasElementConfig, type CanvasElementData, VAlign } from '../types';

import { createMockDimensionContext } from './testHelpers';
import { triangleItem } from './triangle';

const TriangleDisplay = triangleItem.display;

const baseData: CanvasElementData = { align: Align.Center, valign: VAlign.Middle };

describe('triangleItem', () => {
  describe('prepareData', () => {
    it('resolves text, color, background, border and image', () => {
      const ctx = createMockDimensionContext({ text: 'tri', color: '#111111', resource: 'bg.png' });
      const options: CanvasElementOptions<CanvasElementConfig> = {
        name: 'el',
        type: 'triangle',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'tri' },
          align: Align.Center,
          valign: VAlign.Middle,
          color: { fixed: '#111111' },
        },
        background: { color: { fixed: '#222222' }, image: { mode: ResourceDimensionMode.Fixed, fixed: 'bg.png' } },
        border: { color: { fixed: '#333333' }, width: 2 },
      };

      const data = triangleItem.prepareData!(ctx, options);

      expect(data.text).toBe('tri');
      expect(data.color).toBe('#111111');
      expect(data.backgroundColor).toBe('#222222');
      expect(data.borderColor).toBe('#333333');
      expect(data.borderWidth).toBe(2);
      expect(data.backgroundImage).toBe('bg.png');
    });

    it('falls back to defaults when background and border are absent', () => {
      const ctx = createMockDimensionContext();
      const data = triangleItem.prepareData!(ctx, { name: 'el', type: 'triangle', config: undefined });

      expect(data.backgroundColor).toBe(defaultBgColor);
      expect(data.borderColor).toBe(defaultBgColor);
      expect(data.borderWidth).toBe(0);
      expect(data.backgroundImage).toBeUndefined();
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = triangleItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe(defaultBgColor);
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the text inside a polygon svg', () => {
      const { container } = render(
        <TriangleDisplay config={{ align: Align.Center, valign: VAlign.Middle }} data={{ ...baseData, text: 'tri' }} />
      );
      expect(screen.getByText('tri')).toBeInTheDocument();
      expect(container.querySelector('polygon')).toBeInTheDocument();
    });
  });
});
