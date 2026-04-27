import { type PanelModel, OneClickMode } from '@grafana/data';

import { canvasMigrationHandler } from './migrations';

const createCanvasPanel = (elements: Array<Record<string, unknown>>, pluginVersion: string): PanelModel =>
  ({
    type: 'canvas',
    options: {
      root: { elements },
    },
    pluginVersion,
  }) as unknown as PanelModel;

describe('Canvas migration', () => {
  it('should migrate text-box to rectangle for empty plugin version', () => {
    const panel = createCanvasPanel(
      [
        { name: 'Text Box Element', type: 'text-box' },
        { name: 'Other Element', type: 'rectangle' },
      ],
      ''
    );

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].type).toBe('rectangle');
    expect(panel.options.root.elements[1].type).toBe('rectangle');
  });

  it('should migrate ellipse element config for v11.0', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Ellipse Element',
          type: 'ellipse',
          config: {
            backgroundColor: { fixed: 'red' },
            borderColor: { fixed: 'blue' },
            width: 2,
          },
          background: {},
          border: {},
        },
      ],
      '11.0.0'
    );

    panel.options = canvasMigrationHandler(panel);

    const element = panel.options.root.elements[0];
    expect(element.background).toEqual({ fixed: 'red' });
    expect(element.border.color).toEqual({ fixed: 'blue' });
    expect(element.border.width).toBe(2);
    expect(element.config.backgroundColor).toBeUndefined();
    expect(element.config.borderColor).toBeUndefined();
    expect(element.config.width).toBeUndefined();
  });

  it('should only migrate ellipse elements for v11.0', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Rectangle',
          type: 'rectangle',
          config: {
            backgroundColor: { fixed: 'red' },
          },
        },
      ],
      '11.0.0'
    );

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].config.backgroundColor).toEqual({ fixed: 'red' });
  });

  it('should migrate action options to fetch for v11.3 and below', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Element with action',
          type: 'rectangle',
          actions: [
            {
              options: {
                url: 'http://example.com',
                method: 'GET',
              },
            },
          ],
        },
      ],
      '11.3'
    );

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].actions[0].fetch).toEqual({
      url: 'http://example.com',
      method: 'GET',
    });
    expect(panel.options.root.elements[0].actions[0].options).toBeUndefined();
  });

  it('should migrate oneClickMode to action oneClick for v11.6 and below', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Element with action',
          type: 'rectangle',
          oneClickMode: OneClickMode.Action,
          actions: [{ type: 'test' }],
        },
      ],
      '11.6'
    );

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].actions[0].oneClick).toBe(true);
    expect(panel.options.root.elements[0].oneClickMode).toBeUndefined();
  });

  it('should migrate renamed options', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Element 1',
          type: 'ellipse',
          oneClickLinks: true,
          actions: [{ options: { url: 'http://test.com' } }],
          links: [
            { title: 'Link1', url: 'www.link1.com' },
            { title: 'Link2', url: 'www.link2.com' },
          ],
        },
      ],
      '11.2'
    );

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].links[0].oneClick).toBe(true);
    expect(panel.options.root.elements[0].actions[0].fetch.url).toBe('http://test.com');
  });

  it('should migrate connection direction from string to object format', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Element 1',
          type: 'rectangle',
          connections: [
            { direction: 'forward', target: 'element2' },
            { direction: 'reverse', target: 'element3' },
            { direction: 'both', target: 'element4' },
            { target: 'element5' },
          ],
        },
      ],
      '12.1'
    );

    panel.options = canvasMigrationHandler(panel);

    const connections = panel.options.root.elements[0].connections;

    expect(connections[0].direction).toEqual({ mode: 'fixed', fixed: 'forward' });
    expect(connections[1].direction).toEqual({ mode: 'fixed', fixed: 'reverse' });
    expect(connections[2].direction).toEqual({ mode: 'fixed', fixed: 'both' });
    expect(connections[3].direction).toEqual({ mode: 'fixed', fixed: 'forward' });
  });

  it('should not migrate connection direction if already in object format', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Element 1',
          type: 'rectangle',
          connections: [
            {
              direction: { mode: 'fixed', fixed: 'forward' },
              target: 'element2',
            },
          ],
        },
      ],
      '12.1'
    );

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].connections[0].direction).toEqual({
      mode: 'fixed',
      fixed: 'forward',
    });
  });

  it('should handle panel with no root', () => {
    const panel = { type: 'canvas', options: {}, pluginVersion: '' } as unknown as PanelModel;

    const result = canvasMigrationHandler(panel);

    expect(result).toEqual({});
  });

  it('should handle panel with no elements', () => {
    const panel = createCanvasPanel([], '11.0.0');

    const result = canvasMigrationHandler(panel);

    expect(result.root?.elements).toEqual([]);
  });

  it('should handle element with no actions for action migration', () => {
    const panel = createCanvasPanel([{ name: 'Element', type: 'rectangle' }], '11.3');

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].actions).toBeUndefined();
  });

  it('should handle element with no connections for connection migration', () => {
    const panel = createCanvasPanel([{ name: 'Element', type: 'rectangle' }], '12.1');

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].connections).toBeUndefined();
  });

  it('should handle oneClickMode Link with oneClickLinks flag', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Element',
          type: 'rectangle',
          oneClickLinks: true,
          links: [{ title: 'Link', url: 'http://example.com' }],
        },
      ],
      '11.6'
    );

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].links[0].oneClick).toBe(true);
    expect(panel.options.root.elements[0].oneClickLinks).toBeUndefined();
  });

  it('should handle ellipse with partial config for v11.0', () => {
    const panel = createCanvasPanel(
      [
        {
          name: 'Ellipse',
          type: 'ellipse',
          config: { backgroundColor: { fixed: 'red' } },
          background: {},
          border: {},
        },
      ],
      '11.0.0'
    );

    panel.options = canvasMigrationHandler(panel);

    const element = panel.options.root.elements[0];
    expect(element.background).toEqual({ fixed: 'red' });
    expect(element.config.backgroundColor).toBeUndefined();
    expect(element.border.color).toBeUndefined();
  });
});
