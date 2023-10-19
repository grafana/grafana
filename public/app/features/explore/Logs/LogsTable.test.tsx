import { render, screen, waitFor } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import { DataFrame, FieldType, LogsSortOrder, standardTransformersRegistry, toUtc } from '@grafana/data';
import { organizeFieldsTransformer } from '@grafana/data/src/transformations/transformers/organize';
import { config } from '@grafana/runtime';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { LogsTable } from './LogsTable';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getTemplateSrv: () => ({
      replace: (val: string) => (val ? val.replace('$input', '10').replace('$window', '10s') : val),
    }),
  };
});

function getElasticFrame(timestamp: number): DataFrame {
  return {
    fields: [
      {
        name: '@timestamp',
        type: FieldType.time,
        values: [timestamp, timestamp + 1000, timestamp + 2000],
        config: {},
      },
      {
        name: 'line',
        type: FieldType.string,
        values: ['log message 1', 'log message 2', 'log message 3'],
        config: {},
      },
      {
        name: 'counter',
        type: FieldType.string,
        values: ['1', '2', '3'],
        config: {},
      },
      {
        name: 'level',
        type: FieldType.string,
        values: ['info', 'info', 'info'],
        config: {},
      },
      {
        name: 'id',
        type: FieldType.string,
        values: ['1', '2', '3'],
        config: {},
      },
    ],
    length: 3,
  };
}

describe('LogsTable', () => {
  beforeAll(() => {
    const transformers = [extractFieldsTransformer, organizeFieldsTransformer];
    standardTransformersRegistry.setInit(() => {
      return transformers.map((t) => {
        return {
          id: t.id,
          aliasIds: t.aliasIds,
          name: t.name,
          transformation: t,
          description: t.description,
          editor: () => null,
        };
      });
    });
  });

  const getComponent = (partialProps?: Partial<ComponentProps<typeof LogsTable>>, logs?: DataFrame) => {
    const testDataFrame = {
      fields: [
        {
          config: {},
          name: 'Time',
          type: FieldType.time,
          values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
        },
        {
          config: {},
          name: 'line',
          type: FieldType.string,
          values: ['log message 1', 'log message 2', 'log message 3'],
        },
        {
          config: {},
          name: 'tsNs',
          type: FieldType.string,
          values: ['ts1', 'ts2', 'ts3'],
        },
        {
          config: {},
          name: 'labels',
          type: FieldType.other,
          typeInfo: {
            frame: 'json.RawMessage',
          },
          values: [{ foo: 'bar' }, { foo: 'bar' }, { foo: 'bar' }],
        },
      ],
      length: 3,
    };
    return (
      <LogsTable
        height={400}
        columnsWithMeta={{}}
        logsSortOrder={LogsSortOrder.Descending}
        splitOpen={() => undefined}
        timeZone={'utc'}
        width={50}
        range={{
          from: toUtc('2019-01-01 10:00:00'),
          to: toUtc('2019-01-01 16:00:00'),
          raw: { from: 'now-1h', to: 'now' },
        }}
        logsFrames={[logs ?? testDataFrame]}
        {...partialProps}
      />
    );
  };
  const setup = (partialProps?: Partial<ComponentProps<typeof LogsTable>>, logs?: DataFrame) => {
    return render(
      getComponent(
        {
          datasourceType: 'loki',
          ...partialProps,
        },
        logs
      )
    );
  };

  let originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;

  beforeAll(() => {
    originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;
    config.featureToggles.logsExploreTableVisualisation = true;
  });

  afterAll(() => {
    config.featureToggles.logsExploreTableVisualisation = originalVisualisationTypeValue;
  });

  it('should render 4 table rows', async () => {
    setup();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // tableFrame has 3 rows + 1 header row
      expect(rows.length).toBe(4);
    });
  });

  it('should render 4 table rows', async () => {
    setup();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // tableFrame has 3 rows + 1 header row
      expect(rows.length).toBe(4);
    });
  });

  it('should render extracted labels as columns (elastic)', async () => {
    setup({
      datasourceType: 'elastic',
      logsFrames: [getElasticFrame(1697732037084)],
    });

    await waitFor(() => {
      const columns = screen.getAllByRole('columnheader');
      expect(columns[0].textContent).toContain('@timestamp');
      expect(columns[1].textContent).toContain('line');
      expect(columns[2].textContent).toContain('counter');
      expect(columns[3].textContent).toContain('level');
    });
  });

  it('should render extracted labels as columns (loki)', async () => {
    setup({
      datasourceType: 'loki',
      columnsWithMeta: {
        foo: { active: true, percentOfLinesWithLabel: 3 },
      },
    });

    await waitFor(() => {
      const columns = screen.getAllByRole('columnheader');

      expect(columns[0].textContent).toContain('Time');
      expect(columns[1].textContent).toContain('line');
      expect(columns[2].textContent).toContain('foo');
    });
  });

  it('should not render `tsNs`', async () => {
    setup();

    await waitFor(() => {
      const columns = screen.queryAllByRole('columnheader', { name: 'tsNs' });

      expect(columns.length).toBe(0);
    });
  });

  it('should not render `labels`', async () => {
    setup();

    await waitFor(() => {
      const columns = screen.queryAllByRole('columnheader', { name: 'labels' });

      expect(columns.length).toBe(0);
    });
  });

  it('should render a datalink for each row', async () => {
    render(
      getComponent(
        {},
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: FieldType.time,
              values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
            },
            {
              config: {},
              name: 'line',
              type: FieldType.string,
              values: ['log message 1', 'log message 2', 'log message 3'],
            },
            {
              config: {
                links: [
                  {
                    url: 'http://example.com',
                    title: 'foo',
                  },
                ],
              },
              name: 'link',
              type: FieldType.string,
              values: ['ts1', 'ts2', 'ts3'],
            },
          ],
          length: 3,
        }
      )
    );

    await waitFor(() => {
      const links = screen.getAllByRole('link');

      expect(links.length).toBe(3);
    });
  });
});
