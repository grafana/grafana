import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { AdHocFiltersVariable, CustomVariable, LocalValueVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';

import { SectionVariablesCategoryTitle, SectionVariablesList } from './SectionVariablesList';

const mockDashboardVariablesList = jest.fn(
  ({
    renderVariables,
    topPlacementLabel,
  }: {
    renderVariables?: Array<{ state: { name: string; type?: string } }>;
    topPlacementLabel?: string;
  }) => (
    <div>
      {topPlacementLabel && <span>{topPlacementLabel}</span>}
      {renderVariables
        ?.filter((variable) =>
          config.featureToggles.dashboardUnifiedDrilldownControls ? variable.state.type !== 'adhoc' : true
        )
        .map((variable, idx) => (
          <span key={`${variable.state.name}-${idx}`}>{variable.state.name}</span>
        ))}
    </div>
  )
);

jest.mock('./dashboard/DashboardVariablesList', () => ({
  DashboardVariablesList: (props: {
    renderVariables?: Array<{ state: { name: string; type?: string } }>;
    topPlacementLabel?: string;
  }) => mockDashboardVariablesList(props),
}));

describe('SectionVariablesList', () => {
  it('does not render local repeat variables in section variables list', () => {
    const row = buildRow();

    render(<SectionVariablesList sectionOwner={row} />);

    expect(screen.getByText('custom0')).toBeInTheDocument();
    expect(screen.queryByText('$custom0')).not.toBeInTheDocument();
  });

  it('renders a plain top-level variables heading without a count', () => {
    const row = buildRow();

    render(<SectionVariablesCategoryTitle sectionOwner={row} isExpanded={false} />);

    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.queryByText('Variables (2)')).not.toBeInTheDocument();
  });

  describe('when dashboardUnifiedDrilldownControls is enabled', () => {
    beforeEach(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
    });

    afterEach(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
    });

    it('excludes adhoc variables from the list', () => {
      const row = buildRow();

      render(<SectionVariablesList sectionOwner={row} />);

      expect(screen.getByText('custom0')).toBeInTheDocument();
      expect(screen.queryByText('filter0')).not.toBeInTheDocument();
    });
  });

  it('uses top of row label for section variables placement', () => {
    const row = buildRow();

    render(<SectionVariablesList sectionOwner={row} />);

    expect(mockDashboardVariablesList).toHaveBeenCalledWith(
      expect.objectContaining({ topPlacementLabel: 'Top of row' })
    );
  });

  it('uses top of tab label for tab section variables placement', () => {
    const tab = buildTab();

    render(<SectionVariablesList sectionOwner={tab} />);

    expect(mockDashboardVariablesList).toHaveBeenCalledWith(
      expect.objectContaining({ topPlacementLabel: 'Top of tab' })
    );
  });
});

function buildRow() {
  const variableSet = new SceneVariableSet({
    variables: [
      new LocalValueVariable({ name: 'custom0', value: 'glo3', text: 'glo3' }),
      new CustomVariable({ name: 'custom0', query: 'sec1,sec2', value: ['sec1'], text: ['sec1'] }),
      new AdHocFiltersVariable({ name: 'filter0', type: 'adhoc' }),
    ],
  });

  const row = new RowItem({
    repeatByVariable: 'custom0',
    $variables: variableSet,
    layout: AutoGridLayoutManager.createEmpty(),
  });

  new DashboardScene({
    body: new RowsLayoutManager({
      rows: [new RowItem(), row],
    }),
  });

  return row;
}

function buildTab() {
  const variableSet = new SceneVariableSet({
    variables: [new CustomVariable({ name: 'custom0', query: 'sec1,sec2', value: ['sec1'], text: ['sec1'] })],
  });

  const tab = new TabItem({
    $variables: variableSet,
    layout: AutoGridLayoutManager.createEmpty(),
  });

  new DashboardScene({
    body: new TabsLayoutManager({
      tabs: [tab],
    }),
  });

  return tab;
}
