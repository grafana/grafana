import { PanelModel } from '@grafana/data';

import { xyChartMigrationHandler } from './migrations';
import { Options } from './panelcfg.gen';

describe('XYChart migrations', () => {
  it('keep import', () => {
    let input = { series: [] } as unknown as Options;
    const options = xyChartMigrationHandler({
      pluginVersion: 'x.y.z', // when defined
      options: input,
    } as PanelModel);

    // no changes
    expect(options).toBe(input);
  });

  /*
  it('should migrate to new format for GA 10.4 release', () => {
    const panel = {
      options: {
        series: [
          {
            x: 'x',
            y: 'y',
            size: {
              fixed: 10,
            },
            color: {
              fixed: 'red',
            },
          },
        ],
      },
    } as PanelModel;

    const options = xyChartMigrationHandler(panel);
    expect(options.series![0].x).toEqual({
      field: {
        matcher: {
          id: 'byName',
          options: 'x',
        },
      },
    });

    expect(options.series![0].y).toEqual({
      field: {
        matcher: {
          id: 'byName',
          options: 'y',
        },
      },
    });

    // Update these `as any` when types are settled
    expect((options.series![0] as any).size).toEqual({
      fixed: 10,
    });
    expect((options.series![0] as any).color).toEqual({
      fixed: 'red',
    });
  });

  // test to make sure that migration does not run if the plugin version is not empty
  it('should not run migration if plugin version is not empty', () => {
    const panel = {
      pluginVersion: '10.4.0',
      // Old options
      options: {
        series: [
          {
            x: 'x',
            y: 'y',
            size: {
              fixed: 10,
            },
            color: {
              fixed: 'red',
            },
          },
        ],
      },
    } as PanelModel;

    const options = xyChartMigrationHandler(panel);
    expect(options).toEqual(panel.options);
  });

  // Include y exclude fields as well as field matchers for size and color
  it('should include y exclude fields as well as field matchers for size and color', () => {
    const panel = {
      options: {
        series: [
          {
            x: 'x',
            y: 'y',
            size: {
              fixed: 10,
              field: 'size',
            },
            color: {
              fixed: 'red',
              field: 'color',
            },
            dims: {
              exclude: ['y1', 'y2'],
            },
          },
        ],
      },
    } as PanelModel;

    const options = xyChartMigrationHandler(panel);
    expect(options.series![0].y).toEqual({
      field: {
        matcher: {
          id: 'byName',
          options: 'y',
        },
        exclude: {
          id: 'byNames',
          options: ['y1', 'y2'],
        },
      },
    });

    // Update these `as any` when types are settled
    expect((options.series![0] as any).size).toEqual({
      fixed: 10,
      field: {
        matcher: {
          id: 'byName',
          options: 'size',
        },
      },
    });
    expect((options.series![0] as any).color).toEqual({
      fixed: 'red',
      field: {
        matcher: {
          id: 'byName',
          options: 'color',
        },
      },
    });
  });
  */
});
