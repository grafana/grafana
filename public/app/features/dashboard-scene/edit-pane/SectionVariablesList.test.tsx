import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { AdHocFiltersVariable, CustomVariable, LocalValueVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { SectionVariablesCategoryTitle, SectionVariablesList } from './SectionVariablesList';

describe('SectionVariablesList', () => {
  it('does not render local repeat variables in section variables list', () => {
    const row = buildRow();

    render(<SectionVariablesList sectionOwner={row} />);

    expect(screen.getByText('custom0')).toBeInTheDocument();
    expect(screen.queryByText('$custom0')).not.toBeInTheDocument();
  });

  it('counts only non-local variables in title', () => {
    const row = buildRow();

    render(<SectionVariablesCategoryTitle sectionOwner={row} isExpanded={false} />);

    expect(screen.getByText('Variables (2)')).toBeInTheDocument();
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
