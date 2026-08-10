import { buildDashboardPanelFromExploreState } from 'app/features/explore/extensions/AddToDashboard/addToDashboard';
import { getExploreItemSelector } from 'app/features/explore/state/selectors';
import { getState } from 'app/store/store';

import { legacyPanelToNotebookPanel } from './legacyPanelToNotebookPanel';
import { quickAddExploreToLastNotebook } from './quickAddFromExplore';
import { quickAddToLastNotebook } from './quickAddToLastNotebook';

jest.mock('app/features/explore/extensions/AddToDashboard/addToDashboard', () => ({
  buildDashboardPanelFromExploreState: jest.fn(),
}));
jest.mock('app/features/explore/state/selectors', () => ({
  getExploreItemSelector: jest.fn(),
}));
jest.mock('app/store/store', () => ({
  getState: jest.fn(),
}));
jest.mock('./legacyPanelToNotebookPanel', () => ({
  legacyPanelToNotebookPanel: jest.fn(),
}));
jest.mock('./quickAddToLastNotebook', () => ({
  quickAddToLastNotebook: jest.fn(),
}));

const buildPanelMock = jest.mocked(buildDashboardPanelFromExploreState);
const getExploreItemSelectorMock = jest.mocked(getExploreItemSelector);
const getStateMock = jest.mocked(getState);
const legacyPanelToNotebookPanelMock = jest.mocked(legacyPanelToNotebookPanel);
const quickAddToLastNotebookMock = jest.mocked(quickAddToLastNotebook);
const selectExploreItem = jest.fn();

describe('quickAddExploreToLastNotebook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getExploreItemSelectorMock.mockReturnValue(selectExploreItem as never);
    getStateMock.mockReturnValue({} as never);
  });

  it('returns false when the Explore pane is missing', async () => {
    selectExploreItem.mockReturnValue(undefined);

    await expect(quickAddExploreToLastNotebook('left')).resolves.toBe(false);
    expect(buildPanelMock).not.toHaveBeenCalled();
    expect(quickAddToLastNotebookMock).not.toHaveBeenCalled();
  });

  it('converts the Explore panel and preserves its raw time range', async () => {
    const rawTimeRange = { from: 'now-2h', to: 'now' };
    const exploreItem = {
      datasourceInstance: { name: 'Prometheus', getRef: () => ({ uid: 'prometheus' }) },
      queries: [{ refId: 'A' }],
      queryResponse: { series: [] },
      panelsState: { trace: null },
      range: { raw: rawTimeRange },
    };
    const legacyPanel = { title: 'Explore query' };
    const notebookPanel = { kind: 'Panel', spec: { title: 'Explore query' } };
    selectExploreItem.mockReturnValue(exploreItem);
    buildPanelMock.mockReturnValue(legacyPanel as never);
    legacyPanelToNotebookPanelMock.mockReturnValue(notebookPanel as never);
    quickAddToLastNotebookMock.mockResolvedValue(true);

    await expect(quickAddExploreToLastNotebook('left')).resolves.toBe(true);
    expect(buildPanelMock).toHaveBeenCalledWith({
      datasource: { uid: 'prometheus' },
      queries: exploreItem.queries,
      queryResponse: exploreItem.queryResponse,
      panelState: exploreItem.panelsState,
    });
    expect(legacyPanelToNotebookPanelMock).toHaveBeenCalledWith(
      legacyPanel,
      expect.objectContaining({ title: 'Explore query', subtitle: 'From Explore (Prometheus)' })
    );
    expect(quickAddToLastNotebookMock).toHaveBeenCalledWith(notebookPanel, { timeRange: rawTimeRange });
  });
});
