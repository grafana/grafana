import { fuzzySearch } from './fuzzySearch';

describe('fuzzySearch', () => {
  it('should return all indices when needle is empty', () => {
    const haystack = ['A', 'B', 'C', 'D'];
    const result = fuzzySearch(haystack, '');
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('should properly rank by match quality', () => {
    const haystack = ['A', 'AA', 'AB', 'AC', 'BC', 'C', 'CD'];
    const needle = 'C';
    const result = fuzzySearch(haystack, needle);

    const matches = result.map((idx) => haystack[idx]);
    expect(matches).toEqual(['C', 'CD', 'AC', 'BC']);
  });

  it('should handle case sensitivity and order by match quality', () => {
    const haystack = [
      'client_service_namespace',
      'namespace',
      'alert_namespace',
      'container_namespace',
      'Namespace',
      'client_k8s_namespace_name',
      'foobar',
    ];
    const needle = 'Names';
    const result = fuzzySearch(haystack, needle);
    const matches = result.map((idx) => haystack[idx]);

    expect(matches).toEqual([
      'Namespace',
      'namespace',
      'alert_namespace',
      'container_namespace',
      'client_k8s_namespace_name',
      'client_service_namespace',
    ]);
  });

  it('should do substring match when needle contains non-ascii characters', () => {
    const haystack = ['A水', 'AA', 'AB', 'AC', 'BC', 'C', 'CD'];
    const needle = '水';
    const result = fuzzySearch(haystack, needle);

    expect(result.map((idx) => haystack[idx])).toEqual(['A水']);
  });

  it('should do case-insensitive substring match when needle contains non-ascii characters', () => {
    const haystack = ['Über'];
    const needle = 'ü';
    const result = fuzzySearch(haystack, needle);

    expect(result.map((idx) => haystack[idx])).toEqual(['Über']);
  });

  it('should handle multiple non-latin characters', () => {
    const haystack = ['台灣省', '台中市', '台北市', '台南市', '南投縣', '高雄市', '台中第一高級中學'];
    const needle = '南';
    const result = fuzzySearch(haystack, needle);

    expect(result.map((idx) => haystack[idx])).toEqual(['台南市', '南投縣']);
  });

  it('should do substring match when needle contains only symbols', () => {
    const haystack = ['=', '<=', '>', '!~'];
    const needle = '=';
    const result = fuzzySearch(haystack, needle);

    expect(result.map((idx) => haystack[idx])).toEqual(['=', '<=']);
  });

  it('should handle empty haystack', () => {
    const haystack: string[] = [];
    const needle = 'test';
    const result = fuzzySearch(haystack, needle);

    expect(result).toEqual([]);
  });

  it('should handle no matches', () => {
    const haystack = ['apple', 'banana', 'cherry'];
    const needle = 'xyz';
    const result = fuzzySearch(haystack, needle);

    expect(result).toEqual([]);
  });

  it('should return indices in the correct order', () => {
    const haystack = ['zebra', 'apple', 'aardvark', 'application'];
    const needle = 'app';
    const result = fuzzySearch(haystack, needle);

    result.forEach((index) => {
      expect(haystack[index].toLowerCase()).toContain('app');
    });
  });

  it('should handle partial matches', () => {
    const haystack = ['Dashboard', 'Dashboards', 'dash-config', 'config-dash'];
    const needle = 'dash';
    const result = fuzzySearch(haystack, needle);

    expect(result.length).toEqual(haystack.length);
    result.forEach((index) => {
      expect(haystack[index].toLowerCase()).toContain('dash');
    });
  });
});
