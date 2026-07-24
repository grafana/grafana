import { render, screen } from '@testing-library/react';

import { ResourceDimensionMode, TextDimensionMode } from '@grafana/schema';

import { type CanvasElementOptions, defaultBgColor } from '../element';
import { Align, type CanvasElementConfig, type CanvasElementData, VAlign } from '../types';

import { cloudItem } from './cloud';
import { createMockDimensionContext } from './testHelpers';

const CloudDisplay = cloudItem.display;

const baseData: CanvasElementData = { align: Align.Center, valign: VAlign.Middle };

describe('cloudItem', () => {
  describe('prepareData', () => {
    it('resolves text, color, background, border and image', () => {
      const ctx = createMockDimensionContext({ text: 'cloud', color: '#111111', resource: 'bg.png' });
      const options: CanvasElementOptions<CanvasElementConfig> = {
        name: 'el',
        type: 'cloud',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'cloud' },
          align: Align.Center,
          valign: VAlign.Middle,
          color: { fixed: '#111111' },
        },
        background: { color: { fixed: '#222222' }, image: { mode: ResourceDimensionMode.Fixed, fixed: 'bg.png' } },
        border: { color: { fixed: '#333333' }, width: 3 },
      };

      const data = cloudItem.prepareData!(ctx, options);

      expect(data.text).toBe('cloud');
      expect(data.color).toBe('#111111');
      expect(data.backgroundColor).toBe('#222222');
      expect(data.borderColor).toBe('#333333');
      expect(data.borderWidth).toBe(3);
      expect(data.backgroundImage).toBe('bg.png');
    });

    it('falls back to defaults when background and border are absent', () => {
      const ctx = createMockDimensionContext();
      const data = cloudItem.prepareData!(ctx, { name: 'el', type: 'cloud', config: undefined });

      expect(data.backgroundColor).toBe(defaultBgColor);
      expect(data.borderColor).toBe(defaultBgColor);
      expect(data.borderWidth).toBe(0);
      expect(data.backgroundImage).toBeUndefined();
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = cloudItem.getNewOptions();

      expect(options.background?.color?.fixed).toBe(defaultBgColor);
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders the text inside a path svg', () => {
      const { container } = render(
        <CloudDisplay config={{ align: Align.Center, valign: VAlign.Middle }} data={{ ...baseData, text: 'cloud' }} />
      );
      expect(screen.getByText('cloud')).toBeInTheDocument();
      expect(container.querySelector('path')).toBeInTheDocument();
    });
  });
});
