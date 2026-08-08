import { render } from '@testing-library/react';

import { ResourceDimensionMode } from '@grafana/schema';

import { type CanvasElementOptions, defaultBgColor } from '../element';

import { iconItem, type IconConfig } from './icon';
import { createMockDimensionContext } from './testHelpers';

const IconDisplay = iconItem.display;

describe('iconItem', () => {
  describe('prepareData', () => {
    it('resolves the resource path and defaults the fill color', () => {
      const ctx = createMockDimensionContext({ resource: 'my-icon.svg' });
      const options: CanvasElementOptions<IconConfig> = {
        name: 'el',
        type: 'icon',
        config: { path: { mode: ResourceDimensionMode.Fixed, fixed: 'my-icon.svg' } },
      };

      const data = iconItem.prepareData!(ctx, options);

      expect(data.path).toBe('my-icon.svg');
      expect(data.fill).toBe(defaultBgColor);
      expect(ctx.getResource).toHaveBeenCalledTimes(1);
    });

    it('resolves the fill color when config.fill is present', () => {
      const ctx = createMockDimensionContext({ color: '#abcabc', resource: 'my-icon.svg' });
      const data = iconItem.prepareData!(ctx, {
        name: 'el',
        type: 'icon',
        config: { path: { mode: ResourceDimensionMode.Fixed, fixed: 'my-icon.svg' }, fill: { fixed: '#abcabc' } },
      });

      expect(data.fill).toBe('#abcabc');
    });

    it('falls back to question-circle.svg when the path is missing', () => {
      const ctx = createMockDimensionContext();
      const data = iconItem.prepareData!(ctx, { name: 'el', type: 'icon', config: undefined });

      expect(data.path).toContain('question-circle.svg');
      expect(ctx.getResource).not.toHaveBeenCalled();
    });

    it('sets stroke only when stroke.width > 0', () => {
      const ctx = createMockDimensionContext({ color: '#ff0000' });
      const withStroke = iconItem.prepareData!(ctx, {
        name: 'el',
        type: 'icon',
        config: { stroke: { color: { fixed: '#ff0000' }, width: 3 } },
      });
      expect(withStroke.stroke).toBe(3);
      expect(withStroke.strokeColor).toBe('#ff0000');

      const noStroke = iconItem.prepareData!(ctx, {
        name: 'el',
        type: 'icon',
        config: { stroke: { color: { fixed: '#ff0000' }, width: 0 } },
      });
      expect(noStroke.stroke).toBeUndefined();
      expect(noStroke.strokeColor).toBeUndefined();
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with empty links and zero rotation', () => {
      const options = iconItem.getNewOptions();

      expect(options.config?.path?.fixed).toContain('question-circle.svg');
      expect(options.background?.color?.fixed).toBe('transparent');
      expect(options.placement?.rotation).toBe(0);
      expect(options.links).toEqual([]);
    });
  });

  describe('display', () => {
    it('renders an svg for a resolved path', () => {
      const { container } = render(<IconDisplay config={{}} data={{ path: 'my-icon.svg', fill: defaultBgColor }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('returns null when there is no path', () => {
      const { container } = render(<IconDisplay config={{}} data={{ path: '', fill: defaultBgColor }} />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
