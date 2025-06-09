import { escapeForUtf8Support, utf8Support, wrapUtf8Filters } from './utf8_support';

describe('utf8 support', () => {
  it('should return utf8 labels wrapped in quotes', () => {
    const labels = ['valid:label', 'metric_label', 'utf8 label with space 🤘', ''];
    const expected = ['valid:label', 'metric_label', `"utf8 label with space 🤘"`, ''];
    const supportedLabels = labels.map(utf8Support);
    expect(supportedLabels).toEqual(expected);
  });
});

describe('applyValueEncodingEscaping', () => {
  it('should return utf8 labels wrapped in quotes', () => {
    const labels = [
      'no:escaping_required',
      'mysystem.prod.west.cpu.load',
      'mysystem.prod.west.cpu.load_total',
      'http.status:sum',
      'my lovely_http.status:sum',
      '花火',
      'label with 😱',
    ];
    const expected = [
      'no:escaping_required',
      'U__mysystem_2e_prod_2e_west_2e_cpu_2e_load',
      'U__mysystem_2e_prod_2e_west_2e_cpu_2e_load__total',
      'U__http_2e_status:sum',
      'U__my_20_lovely__http_2e_status:sum',
      'U___82b1__706b_',
      'U__label_20_with_20__1f631_',
    ];
    const excapedLabels = labels.map(escapeForUtf8Support);
    expect(excapedLabels).toEqual(expected);
  });
});

describe('wrapUtf8Filters', () => {
  it('should correctly wrap UTF-8 labels and values for multiple key-value pairs', () => {
    const result = wrapUtf8Filters('label.with.spaß="this_is_fun",instance="localhost:9112"');
    const expected = '"label.with.spaß"="this_is_fun",instance="localhost:9112"';
    expect(result).toEqual(expected);
  });

  it('should correctly wrap UTF-8 labels and values for a single key-value pair', () => {
    const result = wrapUtf8Filters('label.with.spaß="this_is_fun"');
    const expected = '"label.with.spaß"="this_is_fun"';
    expect(result).toEqual(expected);
  });

  it('should correctly handle commas within values', () => {
    const result = wrapUtf8Filters('label.with.spaß="this,is,fun",instance="localhost:9112"');
    const expected = '"label.with.spaß"="this,is,fun",instance="localhost:9112"';
    expect(result).toEqual(expected);
  });

  it('should correctly handle escaped quotes within values', () => {
    const result = wrapUtf8Filters(`label.with.spaß="this_is_\\"fun\\"",instance="localhost:9112"`);
    const expected = `"label.with.spaß"="this_is_\\"fun\\"",instance="localhost:9112"`;
    expect(result).toEqual(expected);
  });

  it('should correctly handle spaces within keys', () => {
    const result = wrapUtf8Filters('label with space="value with space",instance="localhost:9112"');
    const expected = '"label with space"="value with space",instance="localhost:9112"';
    expect(result).toEqual(expected);
  });

  it('should correctly process mixed inputs with various formats', () => {
    const result = wrapUtf8Filters('key1="value1",key2="value,with,comma",key3="val3"');
    const expected = 'key1="value1",key2="value,with,comma",key3="val3"';
    expect(result).toEqual(expected);
  });

  it('should correctly handle empty values', () => {
    const result = wrapUtf8Filters('key1="",key2="value2"');
    const expected = 'key1="",key2="value2"';
    expect(result).toEqual(expected);
  });

  it('should handle an empty input string', () => {
    const result = wrapUtf8Filters('');
    const expected = '';
    expect(result).toEqual(expected);
  });

  it('should handle a single key with an empty value', () => {
    const result = wrapUtf8Filters('key1=""');
    const expected = 'key1=""';
    expect(result).toEqual(expected);
  });

  it('should handle multiple consecutive commas in a value', () => {
    const result = wrapUtf8Filters('key1="value1,,value2",key2="value3"');
    const expected = 'key1="value1,,value2",key2="value3"';
    expect(result).toEqual(expected);
  });

  it('should handle a key-value pair with special characters in the key', () => {
    const result = wrapUtf8Filters('special@key#="value1",key2="value2"');
    const expected = '"special@key#"="value1",key2="value2"';
    expect(result).toEqual(expected);
  });

  it('should handle a key-value pair with special characters in the value', () => {
    const result = wrapUtf8Filters('key1="value@#&*",key2="value2"');
    const expected = 'key1="value@#&*",key2="value2"';
    expect(result).toEqual(expected);
  });

  it('should correctly process keys without special characters', () => {
    const result = wrapUtf8Filters('key1="value1",key2="value2"');
    const expected = 'key1="value1",key2="value2"';
    expect(result).toEqual(expected);
  });

  it('should handle nested escaped quotes correctly', () => {
    const result = wrapUtf8Filters('key1="nested \\"escaped\\" quotes",key2="value2"');
    const expected = 'key1="nested \\"escaped\\" quotes",key2="value2"';
    expect(result).toEqual(expected);
  });

  it('should handle escaped quotes correctly', () => {
    const result = wrapUtf8Filters('key1="nested \\"escaped\\" quotes",key2="value with \\"escaped\\" quotes"');
    const expected = 'key1="nested \\"escaped\\" quotes",key2="value with \\"escaped\\" quotes"';
    expect(result).toEqual(expected);
  });

  it('should handle different Prometheus operators correctly', () => {
    const inputs = [
      'label="value"', // equals
      'label!="different value"', // not equals
      'label=~"regex.*value"', // regex match
      'label!~"not.regex.*value"', // regex not match
      'utf8.label.spaß!="no match"', // utf8 with not equals
      'utf8.label.spaß=~"match.*"', // utf8 with regex match
      'complex case=~".*",simple="value"', // multiple operators
    ];

    const expected = [
      'label="value"',
      'label!="different value"',
      'label=~"regex.*value"',
      'label!~"not.regex.*value"',
      '"utf8.label.spaß"!="no match"',
      '"utf8.label.spaß"=~"match.*"',
      '"complex case"=~".*",simple="value"',
    ];

    inputs.forEach((input, index) => {
      const result = wrapUtf8Filters(input);
      expect(result).toEqual(expected[index]);
    });
  });
});
