import { newMarkdownElement, newNotebookSpec, resolveCells } from '../model/notebookSpec';

import { addElementToNotebook } from './addToNotebook';

const mockCreateNotebook = jest.fn();
const mockFetchNotebook = jest.fn();
const mockSaveNotebook = jest.fn();
const mockBroadcast = jest.fn();

jest.mock('../api/notebookAPI', () => ({
  createNotebook: (spec: unknown) => mockCreateNotebook(spec),
  fetchNotebook: (uid: string) => mockFetchNotebook(uid),
  saveNotebook: (resource: unknown) => mockSaveNotebook(resource),
}));

jest.mock('../collab/useNotebookCollab', () => ({
  broadcastNotebookDoc: (uid: string, spec: unknown) => mockBroadcast(uid, spec),
}));

describe('addElementToNotebook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateNotebook.mockImplementation(async (spec) => ({
      metadata: { name: 'nb-new', resourceVersion: '1' },
      spec,
    }));
    mockSaveNotebook.mockImplementation(async (resource) => resource);
  });

  it('creates a new notebook carrying the source time range', async () => {
    const element = newMarkdownElement('captured');

    const result = await addElementToNotebook({ type: 'new', title: 'Fresh investigation' }, element, {
      timeRange: { from: 'now-1h', to: 'now' },
      source: 'user',
    });

    expect(result.uid).toBe('nb-new');
    expect(result.title).toBe('Fresh investigation');
    const createdSpec = mockCreateNotebook.mock.calls[0][0];
    expect(createdSpec.timeSettings.from).toBe('now-1h');
    const cells = resolveCells(createdSpec);
    expect(cells).toHaveLength(1);
    expect(result.elementName).toBe(cells[0].elementName);
    // Nobody can have a not-yet-created notebook open — nothing to broadcast.
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('appends to an existing notebook, saves and broadcasts the saved document', async () => {
    const existing = newNotebookSpec('Ongoing');
    mockFetchNotebook.mockResolvedValue({ metadata: { name: 'nb-1', resourceVersion: '5' }, spec: existing });

    const result = await addElementToNotebook({ type: 'existing', uid: 'nb-1' }, newMarkdownElement('more'));

    expect(mockFetchNotebook).toHaveBeenCalledWith('nb-1');
    const savedResource = mockSaveNotebook.mock.calls[0][0];
    expect(resolveCells(savedResource.spec)).toHaveLength(1);
    expect(mockBroadcast).toHaveBeenCalledWith('nb-1', savedResource.spec);
    expect(result.uid).toBe('nb-1');
  });

  it('locks the block to the absolute capture window when requested', async () => {
    const existing = newNotebookSpec('Ongoing');
    mockFetchNotebook.mockResolvedValue({ metadata: { name: 'nb-1', resourceVersion: '5' }, spec: existing });

    await addElementToNotebook({ type: 'existing', uid: 'nb-1' }, newMarkdownElement('spike'), {
      timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-01T01:00:00.000Z' },
      lockTimeRange: true,
    });

    const cell = resolveCells(mockSaveNotebook.mock.calls[0][0].spec)[0];
    expect(cell.timeFrom).toBe('2026-08-01T00:00:00.000Z');
    expect(cell.timeTo).toBe('2026-08-01T01:00:00.000Z');
  });
});
