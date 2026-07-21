import { render, screen } from '@testing-library/react';

import { ResourceDimensionMode, TextDimensionMode } from '@grafana/schema';

import { type CanvasElementOptions, defaultBgColor } from '../element';
import { Align, type CanvasElementConfig, type CanvasElementData, VAlign } from '../types';

import { parallelogramItem } from './parallelogram';
import { createMockDimensionContext } from './testHelpers';

const ParallelogramDisplay = parallelogramItem.display;

const baseData: CanvasElementData = { align: Align.Center, valign: VAlign.Middle };

describe('parallelogramItem', () => {
  describe('prepareData', () => {
    it('resolves text, color, background, border and image', () => {
      const ctx = createMockDimensionContext({ text: 'para', color: '#111111', resource: 'bg.png' });
      const options: CanvasElementOptions<CanvasElementConfig> = {
        name: 'el',
        type: 'parallelogram',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'para' },
          align: Align.Center,
          valign: VAlign.Middle,
          color: { fixed: '#111111' },
        },
        background: { color: { fixed: '#222222' }, image: { mode: ResourceDimensionMode.Fixed, fixed: 'bg.png' } },
        border: { color: { fixed: '#333333' }, width: 5 },
      };

      const data = parallelogramItem.prepareData!(ctx, options);

      expect(data.text).toBe('para');
      expect(data.color).toBe('#111111');
      expect(data.backgroundColor).toBe('#222222');
      expect(data.borderColor).toBe('#333333');
      expect(data.borderWidth).toBe(5);
      expect(data.backgroundImage).toBe('bg.png');
    });

    it('falls back to defaults when background and border are absent', () => {
      const ctx = createMockDimensionContext();
      const data = parallelogramItem.prepareData!(ctx, { name: 'el', type: 'parallelogram', config: undefined });

      expect(data.backgroundColor).toBe(defaultBgColor);
      expect(data.borderColor).toBe(defaultBgColor);
      expect(data.borderWidth).toBe(0);
      expect(data.backgroundImage).toBeUndefined();
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = parallelogramItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe(defaultBgColor);
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the text inside a polygon svg', () => {
      const { container } = render(
        <ParallelogramDisplay
          config={{ align: Align.Center, valign: VAlign.Middle }}
          data={{ ...baseData, text: 'para' }}
        />
      );
      expect(screen.getByText('para')).toBeInTheDocument();
      expect(container.querySelector('polygon')).toBeInTheDocument();
    });
  });
});
