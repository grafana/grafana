import { dispatch } from 'app/store/store';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_ADD_FAILED_REASON, NOTEBOOK_ENTRY_POINT } from '../analytics/types';
import { NotebookConflictError } from '../api/notebookResource';
import { type PanelElement } from '../types';

import { addToExistingNotebook } from './addPanelToNotebook';
import { addPanelToOpenNotebook } from './addToOpenNotebook';
import { type CapturedTimeRange } from './capturedTimeRange';

jest.mock('app/store/store', () => ({ dispatch: jest.fn() }));
jest.mock('../analytics/main', () => ({ NotebookAnalytics: { addToNotebookFailed: jest.fn() } }));
jest.mock('./addPanelToNotebook', () => ({
  ...jest.requireActual('./addPanelToNotebook'),
  addToExistingNotebook: jest.fn(),
}));

const mockAdd = jest.mocked(addToExistingNotebook);
const mockDispatch = jest.mocked(dispatch);

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the core only forwards it
const panel = { kind: 'Panel', spec: { data: { spec: { queryOptions: {} } } } } as unknown as PanelElement;
const relative: CapturedTimeRange = { from: 'now-6h', to: 'now', timeZone: 'utc' };
const absolute: CapturedTimeRange = { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z', timeZone: 'utc' };
const open = { uid: 'nb-1', title: 'Latency investigation' };

function params(overrides: Partial<Parameters<typeof addPanelToOpenNotebook>[0]> = {}) {
  return {
    buildPanel: jest.fn().mockResolvedValue(panel),
    capturedTimeRange: relative,
    isLibraryPanel: false,
    entryPoint: NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
    open,
    ...overrides,
  };
}

describe('addPanelToOpenNotebook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdd.mockResolvedValue({ uid: open.uid, title: open.title });
  });

  it('appends the panel to the open notebook without locking a relative range', async () => {
    await addPanelToOpenNotebook(params());

    expect(mockAdd).toHaveBeenCalledWith(
      'nb-1',
      [{ kind: 'panel', panel, isLibraryPanel: false }],
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
      'user',
      false
    );
  });

  it('locks an absolute range onto the cell, as the modal does by default', async () => {
    await addPanelToOpenNotebook(params({ capturedTimeRange: absolute }));

    const [, cells, , , lock] = mockAdd.mock.calls[0];
    expect(lock).toBe(true);
    expect(JSON.stringify(cells[0])).toContain('2026-01-01T00:00:00Z');
  });

  it('reports success with a toast', async () => {
    await addPanelToOpenNotebook(params());

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(NotebookAnalytics.addToNotebookFailed).not.toHaveBeenCalled();
  });

  it('reports a write failure with analytics and an error toast', async () => {
    mockAdd.mockRejectedValue(new NotebookConflictError());

    await addPanelToOpenNotebook(params());

    expect(NotebookAnalytics.addToNotebookFailed).toHaveBeenCalledWith(
      'nb-1',
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
      expect.anything(),
      NOTEBOOK_ADD_FAILED_REASON.CONFLICT,
      false
    );
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('tells a failed build apart from a failed write', async () => {
    await addPanelToOpenNotebook(params({ buildPanel: jest.fn().mockRejectedValue(new Error('boom')) }));

    expect(mockAdd).not.toHaveBeenCalled();
    expect(NotebookAnalytics.addToNotebookFailed).toHaveBeenCalledWith(
      'nb-1',
      expect.anything(),
      expect.anything(),
      NOTEBOOK_ADD_FAILED_REASON.BUILD_FAILED,
      false
    );
  });
});
