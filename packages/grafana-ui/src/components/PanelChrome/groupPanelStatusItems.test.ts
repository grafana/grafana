import { type PanelStatusItem } from '@grafana/data';

import { groupPanelStatusItems } from './groupPanelStatusItems';

const notice: PanelStatusItem = { id: 'A', refId: 'A', origin: 'notice', severity: 'warning', text: 'Partial result' };

it('groups action-free notices while retaining identities and Assistant policies', () => {
  const second: PanelStatusItem = { ...notice, id: 'B', refId: 'B', assistant: 'hidden' };
  const groups = groupPanelStatusItems([notice, second]);
  expect(groups).toEqual([[notice, second]]);
  expect(groups[0][0]).toBe(notice);
  expect(groups[0][1]).toBe(second);
});

it.each([false, true])('keeps every custom CTA notice separate, including disabled=%s', (disabled) => {
  const action = { id: 'retry', label: 'Retry', onClick: jest.fn(), disabled };
  const items = [
    notice,
    { ...notice, id: 'B', actions: [action] },
    { ...notice, id: 'C', actions: [action] },
    { ...notice, id: 'D', actions: [] },
  ];
  expect(groupPanelStatusItems(items).map((group) => group.map(({ id }) => id))).toEqual([['A', 'D'], ['B'], ['C']]);
});

it('keeps different severity, links, and non-notice origins separate', () => {
  const items: PanelStatusItem[] = [
    notice,
    { ...notice, id: 'B', severity: 'info' },
    { ...notice, id: 'C', link: '/docs' },
    ...(['query', 'panel', 'plugin-load'] as const).flatMap((origin) => [
      { ...notice, id: `${origin}-1`, origin },
      { ...notice, id: `${origin}-2`, origin },
    ]),
  ];
  expect(groupPanelStatusItems(items).map((group) => group.map(({ id }) => id))).toEqual([
    ['A'],
    ['B'],
    ['C'],
    ['query-1'],
    ['query-2'],
    ['panel-1'],
    ['panel-2'],
    ['plugin-load-1'],
    ['plugin-load-2'],
  ]);
});
