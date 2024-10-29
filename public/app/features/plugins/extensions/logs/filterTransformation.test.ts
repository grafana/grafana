import { lastValueFrom, Observable } from 'rxjs';

import { DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { LogFilter } from './LogViewFilters';
import { createFilterTransformation } from './filterTransformation';

const data = [
  toDataFrame({
    name: 'A',
    length: 3,
    fields: [
      { name: 'pluginId', type: FieldType.string, values: ['grafana-k8s-app', 'grafana', 'mckn-funnel-panel'] },
      {
        name: 'extensionPointId',
        type: FieldType.string,
        values: [
          'grafana/explore/toolbar/actions',
          'grafana-k8s-app/clusters/view/v1',
          'grafana/dashboards/panel/menu/v1',
        ],
      },
      { name: 'severity', type: FieldType.string, values: ['info', 'info', 'info'] },
    ],
  }),
  toDataFrame({
    name: 'B',
    length: 3,
    fields: [
      { name: 'pluginId', type: FieldType.string, values: ['grafana-k8s-app', 'grafana', 'mckn-funnel-panel'] },
      {
        name: 'extensionPointId',
        type: FieldType.string,
        values: [
          'grafana-k8s-app/clusters/view/v1',
          'grafana/dashboards/panel/menu/v1',
          'grafana/explore/toolbar/actions',
        ],
      },
      { name: 'severity', type: FieldType.string, values: ['debug', 'warning', 'error'] },
    ],
  }),
];

describe('Transform data frames by filtering', () => {
  it('should keep all rows when no filter is applied', async () => {
    const [a, b] = await runTransformationWithFilter({}, data);
    expect(a.length).toBe(data[0].length);
    expect(b.length).toBe(data[1].length);
  });

  it('should exclude all rows not matching pluginId', async () => {
    const filter = {
      pluginIds: new Set<string>(['grafana-k8s-app']),
    };
    const [a, b] = await runTransformationWithFilter(filter, data);

    expect(a.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['grafana-k8s-app'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana/explore/toolbar/actions'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['info'],
      },
    ]);

    expect(b.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['grafana-k8s-app'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana-k8s-app/clusters/view/v1'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['debug'],
      },
    ]);
  });

  it('should exclude all rows not matching severity', async () => {
    const filter = {
      severity: new Set<string>(['debug']),
    };
    const [a, b] = await runTransformationWithFilter(filter, data);

    expect(a.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: [],
      },
    ]);

    expect(b.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['grafana-k8s-app'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana-k8s-app/clusters/view/v1'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['debug'],
      },
    ]);
  });

  it('should exclude all rows not matching extensionPointId', async () => {
    const filter = {
      extensionPointIds: new Set<string>(['grafana/dashboards/panel/menu/v1']),
    };
    const [a, b] = await runTransformationWithFilter(filter, data);

    expect(a.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['mckn-funnel-panel'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana/dashboards/panel/menu/v1'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['info'],
      },
    ]);

    expect(b.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['grafana'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana/dashboards/panel/menu/v1'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['warning'],
      },
    ]);
  });

  it('should exclude all rows not matching pluginId and severity', async () => {
    const filter = {
      pluginIds: new Set<string>(['grafana-k8s-app']),
      severity: new Set<string>(['debug']),
    };
    const [a, b] = await runTransformationWithFilter(filter, data);

    expect(a.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: [],
      },
    ]);

    expect(b.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['grafana-k8s-app'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana-k8s-app/clusters/view/v1'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['debug'],
      },
    ]);
  });

  it('should exclude all rows not matching pluginId and severity', async () => {
    const filter = {
      pluginIds: new Set<string>(['grafana-k8s-app', 'grafana']),
      severity: new Set<string>(['info']),
    };
    const [a, b] = await runTransformationWithFilter(filter, data);

    expect(a.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['grafana-k8s-app', 'grafana'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana/explore/toolbar/actions', 'grafana-k8s-app/clusters/view/v1'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['info', 'info'],
      },
    ]);

    expect(b.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: [],
      },
    ]);
  });

  it('should exclude all rows not matching one of pluginId with severity and extensionPointId', async () => {
    const filter = {
      pluginIds: new Set<string>(['grafana-k8s-app', 'grafana']),
      severity: new Set<string>(['info']),
      extensionPointIds: new Set<string>(['grafana/explore/toolbar/actions']),
    };
    const [a, b] = await runTransformationWithFilter(filter, data);

    expect(a.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: ['grafana-k8s-app'],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: ['grafana/explore/toolbar/actions'],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: ['info'],
      },
    ]);

    expect(b.fields).toStrictEqual([
      {
        config: {},
        name: 'pluginId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'extensionPointId',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'severity',
        type: FieldType.string,
        values: [],
      },
    ]);
  });
});

function runTransformationWithFilter(filter: LogFilter, frames: DataFrame[]): Promise<DataFrame[]> {
  const transformation = createFilterTransformation(filter);
  const operator = transformation({ interpolate: () => '' });

  return lastValueFrom(
    new Observable<DataFrame[]>((sub) => {
      sub.next(frames);
      sub.complete();
    }).pipe(operator)
  );
}
