import { OneClickMode, PanelModel } from '@grafana/data';

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
            },
          ],
        },
      },
      pluginVersion: '11.2',
    } as unknown as PanelModel;

    panel.options = canvasMigrationHandler(panel);

    expect(panel.options.root.elements[0].oneClickMode).toBe(OneClickMode.Link);
    expect(panel.options.root.elements[0].actions[0].fetch.url).toBe('http://test.com');
  });
});
