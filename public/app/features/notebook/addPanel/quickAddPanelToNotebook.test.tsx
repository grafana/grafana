import { NotebookUnavailableError } from '../api/notebookResource';
import { defaultPanelKind, type PanelElement } from '../types';

import { addPanelToExistingNotebook } from './addPanelToNotebook';
import { quickAddPanelToNotebook } from './quickAddPanelToNotebook';
import { clearRecentNotebook, getRecentNotebook, setRecentNotebook } from './recentNotebook';

jest.mock('./addPanelToNotebook', () => ({
  ...jest.requireActual('./addPanelToNotebook'),
  addPanelToExistingNotebook: jest.fn(),
}));
jest.mock('./recentNotebook', () => ({
  getRecentNotebook: jest.fn(),
  setRecentNotebook: jest.fn(),
  clearRecentNotebook: jest.fn(),
}));
jest.mock('../analytics/main', () => ({ NotebookAnalytics: { addToNotebookFailed: jest.fn() } }));
jest.mock('app/store/store', () => ({ dispatch: jest.fn() }));

const addToExisting = jest.mocked(addPanelToExistingNotebook);
const getRecent = jest.mocked(getRecentNotebook);
const openPicker = jest.fn();
const panel: PanelElement = defaultPanelKind();

describe('quickAddPanelToNotebook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRecent.mockReturnValue({ uid: 'nb1', title: 'Investigation', at: 100 });
    addToExisting.mockResolvedValue({ uid: 'nb1', title: 'Renamed investigation' });
  });

  it('opens the picker without building a panel when the recent destination expired', async () => {
    getRecent.mockReturnValue(undefined);
    const buildPanel = jest.fn(async () => panel);

    await quickAddPanelToNotebook(buildPanel, 'explore', false, openPicker);

    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(buildPanel).not.toHaveBeenCalled();
    expect(addToExisting).not.toHaveBeenCalled();
  });

  it('adds directly and refreshes the destination after the write succeeds', async () => {
    const buildPanel = jest.fn(async () => panel);

    await quickAddPanelToNotebook(buildPanel, 'dashboard_panel', true, openPicker);

    expect(addToExisting).toHaveBeenCalledWith('nb1', panel, 'dashboard_panel', true);
    expect(setRecentNotebook).toHaveBeenCalledWith('nb1', 'Renamed investigation');
    expect(openPicker).not.toHaveBeenCalled();
  });

  it('does not append the same panel twice when quick add is activated again before the write finishes', async () => {
    let finishWrite: (value: { uid: string; title: string }) => void = () => {};
    addToExisting.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        })
    );

    const first = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker);
    await Promise.resolve();
    const second = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker);
    await second;
    finishWrite({ uid: 'nb1', title: 'Investigation' });
    await first;

    expect(addToExisting).toHaveBeenCalledTimes(1);
  });

  it('forgets an unavailable destination and opens the picker', async () => {
    addToExisting.mockRejectedValue(new NotebookUnavailableError('Forbidden'));

    await quickAddPanelToNotebook(async () => panel, 'explore', false, openPicker);

    expect(clearRecentNotebook).toHaveBeenCalledTimes(1);
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(setRecentNotebook).not.toHaveBeenCalled();
  });

  it('does not forget a destination or reopen the picker on a transient write failure', async () => {
    addToExisting.mockRejectedValue(new Error('Temporary failure'));

    await quickAddPanelToNotebook(async () => panel, 'explore', false, openPicker);

    expect(clearRecentNotebook).not.toHaveBeenCalled();
    expect(openPicker).not.toHaveBeenCalled();
    expect(setRecentNotebook).not.toHaveBeenCalled();
  });
});
