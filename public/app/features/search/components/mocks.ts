export const mockSearch = jest.fn(() => {
  return Promise.resolve([]);
});
jest.mock('app/core/services/search_srv', () => {
  return {
    SearchSrv: jest.fn().mockImplementation(() => {
      return {
        search: mockSearch,
        getDashboardTags: jest.fn(() => Promise.resolve(['Tag1', 'Tag2'])),
        getSortOptions: jest.fn(() => Promise.resolve({ sortOptions: [{ name: 'test', displayName: 'Test' }] })),
      };
    }),
  };
});
