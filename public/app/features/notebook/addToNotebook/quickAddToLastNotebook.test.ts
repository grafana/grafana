import { type NotebookElement } from '@grafana/schema/apis/notebook/v2beta1';

import { addElementToNotebook } from './addToNotebook';
import { quickAddToLastNotebook } from './quickAddToLastNotebook';

jest.mock('./addToNotebook', () => ({
  addElementToNotebook: jest.fn(),
}));

jest.mock('../model/lastUsedNotebook', () => ({
  getLastUsedNotebook: jest.fn(() => ({ uid: 'nb-1', title: 'Spike notes' })),
  clearLastUsedNotebook: jest.fn(),
}));

jest.mock('app/core/app_events', () => ({
  appEvents: { emit: jest.fn() },
}));

const addElementToNotebookMock = jest.mocked(addElementToNotebook);

describe('quickAddToLastNotebook', () => {
  const element = { kind: 'Panel', spec: { title: 'p' } } as unknown as NotebookElement;

  beforeEach(() => {
    jest.clearAllMocks();
    addElementToNotebookMock.mockResolvedValue({ uid: 'nb-1', title: 'Spike notes', elementName: 'el-1' });
  });

  it('locks the time range when the source range is absolute (e.g. after zoom)', async () => {
    await quickAddToLastNotebook(element, {
      timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-01T01:00:00.000Z' },
    });

    expect(addElementToNotebookMock).toHaveBeenCalledWith(
      { type: 'existing', uid: 'nb-1' },
      element,
      expect.objectContaining({ lockTimeRange: true })
    );
  });

  it('does not lock relative time ranges', async () => {
    await quickAddToLastNotebook(element, {
      timeRange: { from: 'now-1h', to: 'now' },
    });

    expect(addElementToNotebookMock).toHaveBeenCalledWith(
      { type: 'existing', uid: 'nb-1' },
      element,
      expect.objectContaining({ lockTimeRange: false })
    );
  });
});
