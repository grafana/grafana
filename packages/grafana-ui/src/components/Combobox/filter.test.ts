import { fuzzyFind } from './filter';

describe('combobox filter', () => {
  it('should properly rank by match quality', () => {
    const needle = 'C';

    const stringOptions = ['A', 'AA', 'AB', 'AC', 'BC', 'C', 'CD'];
    const options = stringOptions.map((value) => ({ value }));

    const matches = fuzzyFind(options, stringOptions, needle);

    expect(matches.map((m) => m.value)).toEqual(['C', 'CD', 'AC', 'BC']);
  });

  it('orders by match quality and case sensitivty', () => {
    const stringOptions = [
      'client_service_namespace',
      'namespace',
      'alert_namespace',
      'container_namespace',
      'Namespace',
      'client_k8s_namespace_name',
      'foobar',
    ];
    const options = stringOptions.map((value) => ({ value }));

    const matches = fuzzyFind(options, stringOptions, 'Names');

    expect(matches.map((m) => m.value)).toEqual([
      'Namespace',
      'namespace',
      'alert_namespace',
      'container_namespace',
      'client_k8s_namespace_name',
      'client_service_namespace',
    ]);
  });

  describe('non-ascii', () => {
    it('should do substring match when needle is non-latin', () => {
      const needle = '水';

      const stringOptions = ['A水', 'AA', 'AB', 'AC', 'BC', 'C', 'CD'];
      const options = stringOptions.map((value) => ({ value }));

      const matches = fuzzyFind(options, stringOptions, needle);

      expect(matches.map((m) => m.value)).toEqual(['A水']);
    });

    it('second case for non-latin characters', () => {
      const stringOptions = ['台灣省', '台中市', '台北市', '台南市', '南投縣', '高雄市', '台中第一高級中學'];

      const options = stringOptions.map((value) => ({ value }));

      const matches = fuzzyFind(options, stringOptions, '南');

      expect(matches.map((m) => m.value)).toEqual(['台南市', '南投縣']);
    });
  });

  describe('operators', () => {
    it('should do substring match when needle is only symbols', () => {
      const needle = '=';

      const stringOptions = ['=', '<=', '>', '!~'];
      const options = stringOptions.map((value) => ({ value }));

      const matches = fuzzyFind(options, stringOptions, needle);

      expect(matches.map((m) => m.value)).toEqual(['=', '<=']);
    });
  });
});
