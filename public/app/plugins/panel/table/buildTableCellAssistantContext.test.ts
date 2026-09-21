import { createAssistantContextItem } from '@grafana/assistant';
import { createDataFrame, dateTime, FieldType } from '@grafana/data';

import { buildTableCellAssistantContext } from './buildTableCellAssistantContext';

jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
}));

beforeEach(() => jest.clearAllMocks());

it.each([42, 'text', null, { status: 'ok' }])(
  'attaches the targeted raw value %j with field, query, and panel context',
  (value) => {
    const frame = createDataFrame({
      refId: 'B',
      meta: { executedQueryString: 'select requests from metrics' },
      fields: [
        {
          name: 'requests',
          type: FieldType.other,
          values: ['wrong row', value],
          config: { unit: 'short' },
          labels: { host: 'a' },
        },
      ],
    });
    frame.fields[0].display = () => ({ text: 'formatted value', numeric: 42 });
    buildTableCellAssistantContext({
      frame,
      field: frame.fields[0],
      rowIndex: 1,
      panelId: 7,
      panelTitle: 'Requests',
      timeRange: { from: dateTime(0), to: dateTime(10000), raw: { from: 'now-1h', to: 'now' } },
      replaceVariables: (s) =>
        s.replace('${__dashboard.uid}', 'dashboard-1').replace('${__dashboard.title}', 'Overview'),
    });
    expect(createAssistantContextItem).toHaveBeenCalledWith('structured', {
      title: 'formatted value › requests a › Requests',
      icon: 'table',
      data: {
        kind: 'table-cell',
        cell: { value, displayValue: 'formatted value', rowIndex: 1 },
        field: {
          name: 'requests',
          displayName: 'requests a',
          type: FieldType.other,
          unit: 'short',
          labels: { host: 'a' },
        },
        query: { refId: 'B', executedQueryString: 'select requests from metrics' },
        panel: {
          panelId: 7,
          panelTitle: 'Requests',
          dashboardUid: 'dashboard-1',
          dashboardTitle: 'Overview',
          timeRange: { from: '1970-01-01T00:00:00.000Z', to: '1970-01-01T00:00:10.000Z' },
        },
      },
    });
  }
);
