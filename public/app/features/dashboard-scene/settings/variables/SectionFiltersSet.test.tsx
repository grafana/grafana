import { VariableHide } from '@grafana/data';
import { AdHocFiltersVariable, CustomVariable, type SceneVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { SectionFiltersSet } from './SectionFiltersSet';

function buildRow({
  includeFilter = false,
  includeCustom = false,
  filterHide = VariableHide.dontHide,
}: { includeFilter?: boolean; includeCustom?: boolean; filterHide?: VariableHide } = {}) {
  const variables = [
    ...(includeFilter ? [new AdHocFiltersVariable({ name: 'filter0', type: 'adhoc', hide: filterHide })] : []),
    ...(includeCustom ? [new CustomVariable({ name: 'custom0', query: 'a,b', value: ['a'], text: ['a'] })] : []),
  ];

  const row = new RowItem({
    $variables: new SceneVariableSet({ variables }),
    layout: AutoGridLayoutManager.createEmpty(),
  });

  new DashboardScene({
    body: new RowsLayoutManager({ rows: [row] }),
  });

  return row;
}

describe('SectionFiltersSet', () => {
  describe('getEditableElementInfo', () => {
    it('returns Filters label and filter icon', () => {
      const row = buildRow({ includeFilter: true });
      const filtersSet = new SectionFiltersSet({ sectionRef: row.getRef() });

      const info = filtersSet.getEditableElementInfo();

      expect(info.typeName).toBe('Filters');
      expect(info.instanceName).toBe('Filters');
      expect(info.icon).toBe('filter');
    });

    it('does not set isHidden so the node always shows in the outline', () => {
      const row = buildRow();
      const filtersSet = new SectionFiltersSet({ sectionRef: row.getRef() });

      const info = filtersSet.getEditableElementInfo();

      expect(info.isHidden).toBeUndefined();
    });
  });

  describe('getOutlineChildren', () => {
    it('returns only adhoc variables', () => {
      const row = buildRow({ includeFilter: true, includeCustom: true });
      const filtersSet = new SectionFiltersSet({ sectionRef: row.getRef() });

      const children = filtersSet.getOutlineChildren();

      expect(children).toHaveLength(1);
      expect((children[0] as SceneVariable).state.name).toBe('filter0');
    });

    it('returns empty array when no adhoc variables exist', () => {
      const row = buildRow({ includeCustom: true });
      const filtersSet = new SectionFiltersSet({ sectionRef: row.getRef() });

      const children = filtersSet.getOutlineChildren();

      expect(children).toHaveLength(0);
    });
  });
});
