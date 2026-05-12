import { render, screen } from '@testing-library/react';

import { AdHocFiltersVariable, CustomVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { SectionFiltersCategoryTitle, SectionFiltersList } from './SectionFiltersList';

jest.mock('./add-new/AddFilters', () => ({
  openAddFilterForm: jest.fn(),
}));

describe('SectionFiltersList', () => {
  it('renders only adhoc filter variables', () => {
    const row = buildRow({ includeFilter: true, includeCustom: true });

    render(<SectionFiltersList sectionOwner={row} />);

    expect(screen.getByText('filter0')).toBeInTheDocument();
    expect(screen.queryByText('custom0')).not.toBeInTheDocument();
  });

  it('shows add filter button when no filters exist', () => {
    const row = buildRow({ includeCustom: true });

    render(<SectionFiltersList sectionOwner={row} />);

    expect(screen.getByText('Add filter')).toBeInTheDocument();
  });

  it('counts only adhoc filter variables when collapsed', () => {
    const row = buildRow({ includeFilter: true, includeCustom: true });

    render(<SectionFiltersCategoryTitle sectionOwner={row} isExpanded={false} />);

    expect(screen.getByText('Filters (1)')).toBeInTheDocument();
  });
});

function buildRow({
  includeFilter = false,
  includeCustom = false,
}: { includeFilter?: boolean; includeCustom?: boolean } = {}) {
  const variables = [
    ...(includeFilter ? [new AdHocFiltersVariable({ name: 'filter0', type: 'adhoc' })] : []),
    ...(includeCustom ? [new CustomVariable({ name: 'custom0', query: 'a,b', value: ['a'], text: ['a'] })] : []),
  ];

  const row = new RowItem({
    $variables: new SceneVariableSet({ variables }),
    layout: AutoGridLayoutManager.createEmpty(),
  });

  new DashboardScene({
    body: new RowsLayoutManager({
      rows: [row],
    }),
  });

  return row;
}
