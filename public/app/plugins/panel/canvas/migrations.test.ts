import { PanelModel } from '@grafana/data';

import { canvasMigrationHandler } from './migrations';

describe('Canvas migration', () => {
  it('should migrate renamed options', () => {
    const panel = {
      type: 'canvas',
      options: {
        root: {
          elements: [
            {
              name: 'Element 1',
              type: 'ellipse',
              oneClickLinks: true,
              actions: [
                {
                  options: {
                    url: 'http://test.com',
                  },
                },
              ],
              links: [
                {
                  title: 'Link1',
                  url: 'www.link1.com',
                },
                {
                  title: 'Link2',
                  url: 'www.link2.com',
                },
              ],
            },
          ],
        },
      },
      pluginVersion: '11.2',
    } as unknown as PanelModel;

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].links[0].oneClick).toBe(true);
    expect(panel.options.root.elements[0].actions[0].fetch.url).toBe('http://test.com');
  });

  it('should migrate connection direction from string to object format', () => {
    const panel = {
      type: 'canvas',
      options: {
        root: {
          elements: [
            {
              name: 'Element 1',
              type: 'rectangle',
              connections: [
                {
                  direction: 'forward',
                  target: 'element2',
                },
                {
                  direction: 'reverse',
                  target: 'element3',
                },
                {
                  direction: 'both',
                  target: 'element4',
                },
                {
                  target: 'element5',
                },
              ],
            },
          ],
        },
      },
      pluginVersion: '12.1',
    } as unknown as PanelModel;

    panel.options = canvasMigrationHandler(panel);

    const connectionsElement1 = panel.options.root.elements[0].connections;

    expect(connectionsElement1[0].direction).toEqual({
      mode: 'fixed',
      fixed: 'forward',
    });

    expect(connectionsElement1[1].direction).toEqual({
      mode: 'fixed',
      fixed: 'reverse',
    });

    expect(connectionsElement1[2].direction).toEqual({
      mode: 'fixed',
      fixed: 'both',
    });
  });
});
