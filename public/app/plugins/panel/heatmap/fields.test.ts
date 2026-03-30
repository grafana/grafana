import { createTheme, dateTime, FieldType } from '@grafana/data';

import { prepareHeatmapData } from './fields';
import { type Options } from './panelcfg.gen';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: Options = {} as Options;

  const tpl = {
    frames: [],
    annotations: [],
    options,
    palette: [],
    theme,
    replaceVariables: undefined,
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
  };

  it('omit empty series array', () => {
    const info = prepareHeatmapData({
      ...tpl,
      frames: [],
    });

    expect(info).toEqual({});
  });

  it('omit frame.length: 0', () => {
    const info = prepareHeatmapData({
      ...tpl,
      frames: [
        {
          fields: [{ name: '', config: {}, type: FieldType.time, values: [] }],
          length: 0,
        },
      ],
    });

    expect(info).toEqual({});
  });
});
