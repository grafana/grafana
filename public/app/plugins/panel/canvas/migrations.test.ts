import { FieldConfigSource, PanelModel } from '@grafana/data';

import { canvasMigrationHandler } from './migrations';

describe('Canvas data links migration', () => {
  let prevFieldConfig: FieldConfigSource;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'B-series' },
          properties: [
            {
              id: 'links',
              value: [
                { title: 'Test B-series override', url: '${__series.name}' },
                { title: 'Test B-series override 2', url: '${__field.name}' },
                { title: 'Test B-series override 3', url: '${__field.labels.foo}' },
              ],
            },
          ],
        },
      ],
    };
  });

  it('should migrate data links', () => {
    const panel = {
      type: 'canvas',
      fieldConfig: prevFieldConfig,
      options: {
        root: {
          elements: [
            {
              type: 'metric-value',
              config: {
                text: {
                  mode: 'field',
                  field: 'B-series',
                  fixed: '',
                },
                size: 20,
                color: {
                  fixed: '#000000',
                },
                align: 'center',
                valign: 'middle',
              },
              background: {
                color: {
                  field: 'time',
                  fixed: '#D9D9D9',
                },
              },
              border: {
                color: {
                  fixed: 'dark-green',
                },
              },
              placement: {
                top: 100,
                left: 100,
                width: 260,
                height: 50,
              },
              name: 'Element 1',
              constraint: {
                vertical: 'top',
                horizontal: 'left',
              },
              links: [],
            },
          ],
        },
      },
      pluginVersion: '11.1.0',
    } as unknown as PanelModel;
    panel.options = canvasMigrationHandler(panel);

    const links = panel.options.root.elements[0].links;
    expect(links).toHaveLength(3);
    expect(links[0].url).toBe('${__data.fields["B-series"]}');
    expect(links[1].url).toBe('${__data.fields["B-series"]}');
    expect(links[2].url).toBe('${__data.fields["B-series"].labels.foo}');
  });
});
