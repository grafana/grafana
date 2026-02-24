import { validatePolicyTreeName } from './utils';

describe('validatePolicyTreeName', () => {
  it.each(['prometheus-prod', 'my-alertmanager', 'a', 'abc123', 'my.config.name', 'a-b.c-d', '0', '1abc2'])(
    'accepts valid name: "%s"',
    (name) => {
      expect(validatePolicyTreeName(name)).toBe(true);
    }
  );

  it.each([
    { name: '', reason: 'empty string' },
    { name: 'Uppercase', reason: 'contains uppercase letters' },
    { name: '-starts-with-dash', reason: 'starts with dash' },
    { name: 'ends-with-dash-', reason: 'ends with dash' },
    { name: '.starts-with-dot', reason: 'starts with dot' },
    { name: 'ends-with-dot.', reason: 'ends with dot' },
    { name: 'has spaces', reason: 'contains spaces' },
    { name: 'has_underscore', reason: 'contains underscore' },
    { name: 'special!char', reason: 'contains special characters' },
  ])('rejects invalid format ($reason): "$name"', ({ name }) => {
    const result = validatePolicyTreeName(name);
    expect(result).not.toBe(true);
    expect(result).toContain('lowercase alphanumeric');
  });

  it('rejects names exceeding 40 characters', () => {
    const longName = 'a'.repeat(41);
    const result = validatePolicyTreeName(longName);
    expect(result).not.toBe(true);
    expect(result).toContain('at most 40');
  });

  it('accepts names exactly 40 characters long', () => {
    const maxName = 'a'.repeat(40);
    expect(validatePolicyTreeName(maxName)).toBe(true);
  });

  it('checks length before format', () => {
    const longInvalid = 'A'.repeat(41);
    const result = validatePolicyTreeName(longInvalid);
    expect(result).toContain('at most 40');
  });
});
