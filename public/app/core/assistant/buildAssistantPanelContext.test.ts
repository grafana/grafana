import { dateTime } from '@grafana/data';

import { buildAssistantPanelContext } from './buildAssistantPanelContext';

it.each([
  [
    'resolved',
    (s: string) => s.replace('${__dashboard.uid}', 'dash-1').replace('${__dashboard.title}', 'Overview'),
    'dash-1',
    'Overview',
  ],
  ['unresolved', (s: string) => s, undefined, undefined],
  ['empty', () => '', undefined, undefined],
])('builds panel context with %s dashboard macros', (_, replaceVariables, dashboardUid, dashboardTitle) => {
  expect(
    buildAssistantPanelContext({
      panelId: 7,
      panelTitle: 'Requests',
      replaceVariables,
      timeRange: { from: dateTime(0), to: dateTime(10000), raw: { from: 'now-1h', to: 'now' } },
    })
  ).toEqual({
    panelId: 7,
    panelTitle: 'Requests',
    dashboardUid,
    dashboardTitle,
    timeRange: { from: '1970-01-01T00:00:00.000Z', to: '1970-01-01T00:00:10.000Z' },
  });
});
