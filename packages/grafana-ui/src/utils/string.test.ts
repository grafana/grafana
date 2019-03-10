import { stringToJsRegex } from '@grafana/ui';

describe('stringToJsRegex', () => {
  it('should parse the valid regex value', () => {
    const output = stringToJsRegex('/validRegexp/');
    expect(output).toBeInstanceOf(RegExp);
  });

  it('should throw error on invalid regex value', () => {
    const input = '/etc/hostname';
    expect(() => {
      stringToJsRegex(input);
    }).toThrow();
  });
});
