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
});
