import { waitFor } from '@testing-library/react';

import { NotebookAnalytics } from '../analytics/main';
import { NotebookUnavailableError } from '../api/notebookResource';
import { defaultPanelKind, type PanelElement } from '../types';

import { addToExistingNotebook } from './addPanelToNotebook';
import { withCapturedTimeRange } from './capturedTimeRange';
import { quickAddPanelToNotebook } from './quickAddPanelToNotebook';
import { clearRecentNotebook, getRecentNotebook, setRecentNotebook } from './recentNotebook';

jest.mock('./addPanelToNotebook', () => ({
  ...jest.requireActual('./addPanelToNotebook'),
  addToExistingNotebook: jest.fn(),
}));
jest.mock('./recentNotebook', () => ({
  getRecentNotebook: jest.fn(),
  setRecentNotebook: jest.fn(),
  clearRecentNotebook: jest.fn(),
}));
jest.mock('../analytics/main', () => ({ NotebookAnalytics: { addToNotebookFailed: jest.fn() } }));
jest.mock('app/store/store', () => ({ dispatch: jest.fn() }));

const addToExisting = jest.mocked(addToExistingNotebook);
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

    await quickAddPanelToNotebook(buildPanel, 'explore', false, openPicker, 'left');

    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(buildPanel).not.toHaveBeenCalled();
    expect(addToExisting).not.toHaveBeenCalled();
  });

  it('adds directly and refreshes the destination after the write succeeds', async () => {
    const buildPanel = jest.fn(async () => panel);

    await quickAddPanelToNotebook(buildPanel, 'dashboard_panel', true, openPicker, 'panel-1');

    expect(addToExisting).toHaveBeenCalledWith(
      'nb1',
      [{ kind: 'panel', panel, isLibraryPanel: true }],
      'dashboard_panel',
      'user',
      false
    );
    expect(setRecentNotebook).toHaveBeenCalledWith('nb1', 'Renamed investigation');
    expect(openPicker).not.toHaveBeenCalled();
  });

  it('preserves the captured window and reports a locked panel when quick adding', async () => {
    const lockedPanel = withCapturedTimeRange(panel, {
      from: '2026-10-20T09:00:00.000Z',
      to: '2026-10-20T10:00:00.000Z',
    });

    await quickAddPanelToNotebook(async () => lockedPanel, 'explore', false, openPicker, 'left');

    expect(addToExisting).toHaveBeenCalledWith(
      'nb1',
      [{ kind: 'panel', panel: lockedPanel, isLibraryPanel: false }],
      'explore',
      'user',
      true
    );
  });

  it('reports the captured lock state when a quick add fails', async () => {
    const lockedPanel = withCapturedTimeRange(panel, {
      from: '2026-10-20T09:00:00.000Z',
      to: '2026-10-20T10:00:00.000Z',
    });
    addToExisting.mockRejectedValueOnce(new NotebookUnavailableError('Forbidden'));

    await quickAddPanelToNotebook(async () => lockedPanel, 'explore', false, openPicker, 'left');

    expect(NotebookAnalytics.addToNotebookFailed).toHaveBeenCalledWith(
      'nb1',
      'explore',
      'existing',
      'write_failed',
      true
    );
    expect(openPicker).toHaveBeenCalledTimes(1);
  });

  it('does not append the same panel twice when quick add is activated again before the write finishes', async () => {
    let finishWrite: (value: { uid: string; title: string }) => void = () => {};
    addToExisting.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        })
    );

    const first = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-1');
    await Promise.resolve();
    const second = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-1');
    await second;
    finishWrite({ uid: 'nb1', title: 'Investigation' });
    await first;

    expect(addToExisting).toHaveBeenCalledTimes(1);
  });

  it('queues another panel for the same notebook until the first write finishes', async () => {
    const finishWrites: Array<(value: { uid: string; title: string }) => void> = [];
    addToExisting.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWrites.push(resolve);
        })
    );

    const first = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-1');
    const second = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-2');
    await waitFor(() => expect(addToExisting).toHaveBeenCalledTimes(1));

    finishWrites[0]({ uid: 'nb1', title: 'Investigation' });
    await first;
    await waitFor(() => expect(addToExisting).toHaveBeenCalledTimes(2));
    finishWrites[1]({ uid: 'nb1', title: 'Investigation' });
    await second;

    expect(setRecentNotebook).toHaveBeenCalledTimes(2);
  });

  it('continues queued adds after a write fails', async () => {
    addToExisting.mockRejectedValueOnce(new Error('Temporary failure'));

    const first = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-1');
    const second = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-2');
    await Promise.all([first, second]);

    expect(addToExisting).toHaveBeenCalledTimes(2);
    expect(setRecentNotebook).toHaveBeenCalledTimes(1);
  });

  it('forgets an unavailable destination and opens the picker', async () => {
    addToExisting.mockRejectedValue(new NotebookUnavailableError('Forbidden'));

    await quickAddPanelToNotebook(async () => panel, 'explore', false, openPicker, 'left');

    expect(clearRecentNotebook).toHaveBeenCalledTimes(1);
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(setRecentNotebook).not.toHaveBeenCalled();
  });

  it('does not retry an unavailable destination for queued panels', async () => {
    addToExisting.mockRejectedValueOnce(new NotebookUnavailableError('Forbidden'));

    const first = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-1');
    const second = quickAddPanelToNotebook(async () => panel, 'dashboard_panel', false, openPicker, 'panel-2');
    await Promise.all([first, second]);

    expect(addToExisting).toHaveBeenCalledTimes(1);
    expect(clearRecentNotebook).toHaveBeenCalledTimes(1);
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(setRecentNotebook).not.toHaveBeenCalled();
  });

  it('does not forget a destination or reopen the picker on a transient write failure', async () => {
    addToExisting.mockRejectedValue(new Error('Temporary failure'));

    await quickAddPanelToNotebook(async () => panel, 'explore', false, openPicker, 'left');

    expect(clearRecentNotebook).not.toHaveBeenCalled();
    expect(openPicker).not.toHaveBeenCalled();
    expect(setRecentNotebook).not.toHaveBeenCalled();
  });
});
