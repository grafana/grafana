export const mockSearch = jest.fn<any, any>(() => {
  return Promise.resolve([]);
});

jest.mock('app/core/services/search_srv', () => {
  return {
    SearchSrv: jest.fn().mockImplementation(() => {
      return {
        search: mockSearch,
        getDashboardTags: jest.fn(() =>
          Promise.resolve([
            { term: 'tag1', count: 2 },
            { term: 'tag2', count: 10 },
          ])
        ),
        getSortOptions: jest.fn(() => Promise.resolve({ sortOptions: [{ name: 'test', displayName: 'Test' }] })),
      };
    }),
  };
});
