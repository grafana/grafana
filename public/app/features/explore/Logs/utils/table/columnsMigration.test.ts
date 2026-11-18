import { type ExploreLogsPanelState } from '@grafana/data';

import { getDefaultDisplayedFieldsFromExploreState } from './columnsMigration';

describe('getDefaultDisplayedFieldsFromExploreState', () => {
  const updatePanelState = jest.fn();
  it('returns displayed fields if defined', () => {
    const panelState: ExploreLogsPanelState = {
      columns: ['timestamp', 'body'],
      displayedFields: ['ts', 'line'],
    };

    expect(getDefaultDisplayedFieldsFromExploreState(panelState, updatePanelState)).toEqual(['ts', 'line']);
  });

  it('returns displayed fields if logs panel', () => {
    const panelState: ExploreLogsPanelState = {
      columns: ['timestamp', 'body'],
      displayedFields: [],
      visualisationType: 'logs',
    };

    expect(getDefaultDisplayedFieldsFromExploreState(panelState, updatePanelState)).toEqual([]);
    expect(updatePanelState).toHaveBeenCalledTimes(0);
  });

  it('migrates columns', () => {
    const panelState: ExploreLogsPanelState = {
      columns: { 0: 'timestamp', 1: 'body' },
      displayedFields: [],
      visualisationType: 'table',
    };

    expect(getDefaultDisplayedFieldsFromExploreState(panelState, updatePanelState)).toEqual(['timestamp', 'body']);
    expect(updatePanelState).toHaveBeenCalledTimes(1);
    expect(updatePanelState).toHaveBeenCalledWith({
      columns: [],
      displayedFields: ['timestamp', 'body'],
      visualisationType: 'table',
    });
  });
});
