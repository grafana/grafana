import kbn from '../utils/kbn';

describe('stringToJsRegex', () => {
  it('should parse the valid regex value', () => {
    const output = kbn.stringToJsRegex('/validRegexp/');
    expect(output).toBeInstanceOf(RegExp);
  });

  it('should throw error on invalid regex value', () => {
    const input = '/etc/hostname';
    expect(() => {
      kbn.stringToJsRegex(input);
    }).toThrow();
  });
});
