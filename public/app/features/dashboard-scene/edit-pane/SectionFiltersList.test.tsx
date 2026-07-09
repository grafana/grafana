import { render, screen } from '@testing-library/react';

import { AdHocFiltersVariable, CustomVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { SectionFiltersCategoryTitle, SectionFiltersList } from './SectionFiltersList';

const mockDashboardVariablesList = jest.fn(
  ({
    renderVariables,
    topPlacementLabel,
    includeAdHoc,
  }: {
    renderVariables?: Array<{ state: { name: string } }>;
    topPlacementLabel?: string;
    includeAdHoc?: boolean;
  }) => (
    <div>
      {topPlacementLabel && <span>{topPlacementLabel}</span>}
      {includeAdHoc && <span>includeAdHoc</span>}
      {renderVariables?.map((variable, idx) => (
        <span key={`${variable.state.name}-${idx}`}>{variable.state.name}</span>
      ))}
    </div>
  )
);

jest.mock('./add-new/AddFilters', () => ({
  openAddFilterForm: jest.fn(),
}));

jest.mock('./dashboard/DashboardVariablesList', () => ({
  DashboardVariablesList: (props: {
    renderVariables?: Array<{ state: { name: string } }>;
    topPlacementLabel?: string;
    includeAdHoc?: boolean;
  }) => mockDashboardVariablesList(props),
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

  it('renders a plain top-level filters heading without a count', () => {
    render(<SectionFiltersCategoryTitle />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.queryByText('Filters (1)')).not.toBeInTheDocument();
  });

  it('uses top of row label for section filters placement', () => {
    const row = buildRow({ includeFilter: true });

    render(<SectionFiltersList sectionOwner={row} />);

    expect(mockDashboardVariablesList).toHaveBeenCalledWith(
      expect.objectContaining({ topPlacementLabel: 'Top of row', includeAdHoc: true })
    );
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
