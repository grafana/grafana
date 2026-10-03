import { createAssistantContextItem } from '@grafana/assistant';
import { createDataFrame, dateTime, FieldType } from '@grafana/data';

import { buildTableFieldAssistantContext } from './buildTableFieldAssistantContext';

jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
}));

it('attaches every raw and formatted value with field, query, and panel metadata', () => {
  const frame = createDataFrame({
    refId: 'B',
    meta: { executedQueryString: 'select requests from metrics' },
    fields: [
      {
        name: 'requests',
        type: FieldType.number,
        values: [42, null, 7],
        config: { unit: 'short' },
        labels: { host: 'a' },
      },
    ],
  });
  frame.fields[0].display = (value) => ({
    text: value == null ? 'No data' : `${value} requests`,
    numeric: Number(value),
  });
  buildTableFieldAssistantContext({
    frame,
    field: frame.fields[0],
    panelId: 7,
    panelTitle: 'Requests',
    timeRange: { from: dateTime(0), to: dateTime(10000), raw: { from: 'now-1h', to: 'now' } },
    replaceVariables: (s) => s.replace('${__dashboard.uid}', 'dashboard-1').replace('${__dashboard.title}', 'Overview'),
  });
  expect(createAssistantContextItem).toHaveBeenCalledWith('structured', {
    title: 'requests a › Requests',
    icon: 'table',
    data: {
      kind: 'table-field',
      field: {
        name: 'requests',
        displayName: 'requests a',
        type: FieldType.number,
        unit: 'short',
        labels: { host: 'a' },
        values: [42, null, 7],
        displayValues: ['42 requests', 'No data', '7 requests'],
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
});
