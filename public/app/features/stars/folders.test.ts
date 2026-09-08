import { resolveStarredFolders } from './folders';

const mockSearch = jest.fn();

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: () => ({ search: mockSearch }),
}));

describe('resolveStarredFolders', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockSearch.mockResolvedValue({ view: { map: () => [] } });
  });

  it('forwards the permission to the searcher', async () => {
    await resolveStarredFolders(['fa'], 'view');

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: ['folder'], name: ['fa'], permission: 'view' })
    );
  });

  it('passes an undefined permission through when none is given', async () => {
    await resolveStarredFolders(['fa']);

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: ['folder'], name: ['fa'], permission: undefined })
    );
  });

  it('returns an empty list and never queries the searcher when there are no UIDs', async () => {
    const result = await resolveStarredFolders([]);

    expect(result).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
