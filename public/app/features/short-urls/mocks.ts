export const mockUid = 'testShortLinkUid';
export const mockResolvedPath = 'mock/path?test=true';

export const mockShortUrlLookup = jest.fn(() => {
  return Promise.resolve(mockResolvedPath);
});
jest.mock(`api/goto/${mockUid}`, () => {
  return {
    SearchSrv: jest.fn().mockImplementation(() => {
      return mockShortUrlLookup;
    }),
  };
});
