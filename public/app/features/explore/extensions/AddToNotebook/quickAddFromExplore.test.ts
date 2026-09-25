import { buildPanelElementFromExplore } from 'app/features/notebook/addPanel/buildPanelElementFromExplore';
import { quickAddPanelToNotebook } from 'app/features/notebook/addPanel/quickAddPanelToNotebook';
import { defaultPanelKind } from 'app/features/notebook/types';
import { getState } from 'app/store/store';
import { type StoreState } from 'app/types/store';

import { quickAddFromExplore } from './quickAddFromExplore';

jest.mock('app/features/notebook/addPanel/buildPanelElementFromExplore');
jest.mock('app/features/notebook/addPanel/quickAddPanelToNotebook', () => ({ quickAddPanelToNotebook: jest.fn() }));
jest.mock('app/store/store', () => ({ getState: jest.fn() }));

const baseState = jest.requireActual<{ getState: () => StoreState }>('app/store/store').getState();

describe('quickAddFromExplore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the panel from the selected Explore pane', async () => {
    const pane = {
      datasourceInstance: { getRef: jest.fn().mockReturnValue({ type: 'prometheus', uid: 'prom' }) },
      queries: [{ refId: 'A' }],
      queryResponse: { data: [] },
      panelsState: { logs: { id: 'log-row-1' } },
    };
    jest.mocked(getState).mockReturnValue(Object.assign({}, baseState, { explore: { panes: { left: pane } } }));
    jest.mocked(buildPanelElementFromExplore).mockReturnValue(defaultPanelKind());
    jest.mocked(quickAddPanelToNotebook).mockImplementation(async (buildPanel) => {
      await buildPanel();
    });
    const openPicker = jest.fn();

    await quickAddFromExplore('left', openPicker);

    expect(quickAddPanelToNotebook).toHaveBeenCalledWith(expect.any(Function), 'explore', false, openPicker, 'left');
    expect(buildPanelElementFromExplore).toHaveBeenCalledWith({
      datasource: { type: 'prometheus', uid: 'prom' },
      queries: pane.queries,
      queryResponse: pane.queryResponse,
      panelState: pane.panelsState,
    });
    expect(openPicker).not.toHaveBeenCalled();
  });

  it('opens the picker when the Explore pane is no longer available', async () => {
    jest.mocked(getState).mockReturnValue(Object.assign({}, baseState, { explore: { panes: {} } }));
    const openPicker = jest.fn();

    await quickAddFromExplore('left', openPicker);

    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(quickAddPanelToNotebook).not.toHaveBeenCalled();
  });

  it('opens the picker when Explore state is no longer available', async () => {
    jest.mocked(getState).mockReturnValue(Object.assign({}, baseState, { explore: undefined }));
    const openPicker = jest.fn();

    await quickAddFromExplore('left', openPicker);

    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(quickAddPanelToNotebook).not.toHaveBeenCalled();
  });

  it('builds the panel without a datasource while it is loading', async () => {
    const pane = { queries: [{ refId: 'A' }], queryResponse: { data: [] }, panelsState: {} };
    jest.mocked(getState).mockReturnValue(Object.assign({}, baseState, { explore: { panes: { left: pane } } }));
    jest.mocked(buildPanelElementFromExplore).mockReturnValue(defaultPanelKind());
    jest.mocked(quickAddPanelToNotebook).mockImplementation(async (buildPanel) => {
      await buildPanel();
    });

    await quickAddFromExplore('left', jest.fn());

    expect(buildPanelElementFromExplore).toHaveBeenCalledWith(expect.objectContaining({ datasource: undefined }));
  });
});
