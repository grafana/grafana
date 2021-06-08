import ResponseParser from './response_parser';

describe('respose_parser', () => {
  describe('transformAnnotationResponse', () => {
    it('returns empty list for empty responses', async () => {
      const parser = new ResponseParser();

      const result = await parser.transformAnnotationResponse({}, { results: {} });

      expect(result).toEqual([]);
    });
  });
});
