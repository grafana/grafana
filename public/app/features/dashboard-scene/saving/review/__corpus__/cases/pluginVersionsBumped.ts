import { dashboard, edit, elements, gridOf, panel, panelSpecOf, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

const names = ['panel-1', 'panel-2', 'panel-3', 'panel-4'];

const baseline = dashboard({
  elements: elements(
    ['panel-1', panel('Requests', { id: 1, vizVersion: '13.3.0' })],
    ['panel-2', panel('Errors', { id: 2, vizVersion: '13.3.0' })],
    ['panel-3', panel('Latency', { id: 3, vizVersion: '13.3.0' })],
    ['panel-4', panel('Saturation', { id: 4, vizVersion: '13.3.0' })]
  ),
  layout: gridOf(...names),
});

// Opened and saved, unedited, after a Grafana upgrade: every loaded panel stamps the new plugin version.
export const pluginVersionsBumped: ReviewCorpusCase = {
  name: 'system defaults: plugin versions bumped by an upgrade, nothing else edited',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline,
    payload: edit(baseline, (d) => {
      names.forEach((name) => {
        panelSpecOf(d, name).vizConfig.version = '13.4.0';
      });
    }),
  },
  expected: text`
Counts: 0 added, 0 changed, 0 removed, 0 moved

System defaults (4)
  Panel "Requests"
    Plugin version: 13.3.0 → 13.4.0
  Panel "Errors"
    Plugin version: 13.3.0 → 13.4.0
  Panel "Latency"
    Plugin version: 13.3.0 → 13.4.0
  Panel "Saturation"
    Plugin version: 13.3.0 → 13.4.0
`,
};
