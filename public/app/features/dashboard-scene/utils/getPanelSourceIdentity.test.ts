import { LocalValueVariable, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';

import { getCloneKey } from './clone';
import { djb2Hash } from './djb2Hash';
import { getPanelSourceIdentity, getRepeatClonePathHash } from './getPanelSourceIdentity';

function buildRepeatedRow(value: string) {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'barchart' });

  new RowItem({
    key: `row-clone-${value}`,
    repeatSourceKey: 'row-1',
    $variables: new SceneVariableSet({ variables: [new LocalValueVariable({ name: 'country', value })] }),
    layout: new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }),
    }),
  });

  return panel;
}

describe('getPanelSourceIdentity', () => {
  it('uses the key of a panel that is not repeated', () => {
    const panel = new VizPanel({ key: 'panel-3', pluginId: 'barchart' });

    expect(getRepeatClonePathHash(panel)).toBeUndefined();
    expect(getPanelSourceIdentity(panel)).toBe('panel-3');
  });

  it('uses a hash of the path for a repeat clone', () => {
    const panel = new VizPanel({
      key: getCloneKey('panel-2', 1),
      repeatSourceKey: 'panel-2',
      pluginId: 'barchart',
      $variables: new SceneVariableSet({ variables: [new LocalValueVariable({ name: 'country', value: 'UK' })] }),
    });

    const hash = djb2Hash('UK$panel-2');
    expect(getRepeatClonePathHash(panel)).toBe(hash);
    expect(getPanelSourceIdentity(panel)).toBe(`clone-${hash}`);
  });

  it('tells apart panels in repeated rows that share the same key', () => {
    const first = buildRepeatedRow('UK');
    const second = buildRepeatedRow('FR');

    expect(first.state.key).toBe(second.state.key);
    expect(getPanelSourceIdentity(first)).toBe(`clone-${djb2Hash('UK$panel-1')}`);
    expect(getPanelSourceIdentity(second)).toBe(`clone-${djb2Hash('FR$panel-1')}`);
  });
});
