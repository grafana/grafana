import { render, screen } from '@testing-library/react';

import { CustomVariable, LocalValueVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { SectionVariablesCategoryTitle, SectionVariablesList } from './SectionVariablesList';

describe('SectionVariablesList', () => {
  it('does not render local repeat variables in section variables list', () => {
    const row = buildRowWithVariables();

    render(<SectionVariablesList sectionOwner={row} />);

    expect(screen.getByText('custom0')).toBeInTheDocument();
    expect(screen.queryByText('$custom0')).not.toBeInTheDocument();
  });

  it('counts only non-local variables in title', () => {
    const row = buildRowWithVariables();

    render(<SectionVariablesCategoryTitle sectionOwner={row} isExpanded={false} />);

    expect(screen.getByText('Variables (1)')).toBeInTheDocument();
  });
});

function buildRowWithVariables() {
  const variableSet = new SceneVariableSet({
    variables: [
      new LocalValueVariable({ name: 'custom0', value: 'glo3', text: 'glo3' }),
      new CustomVariable({ name: 'custom0', query: 'sec1,sec2', value: ['sec1'], text: ['sec1'] }),
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
