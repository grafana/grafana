import { validateGroup, validateVersion } from './prompts';

describe('validateGroup', () => {
  it('accepts a well-formed group', () => {
    expect(validateGroup('dashboard.grafana.app')).toBe(true);
  });

  it('rejects a group without the grafana.app suffix', () => {
    expect(validateGroup('dashboard')).toEqual(expect.stringContaining('name.grafana.app'));
  });

  it('rejects an empty string', () => {
    expect(validateGroup('')).toEqual(expect.stringContaining('name.grafana.app'));
  });
});

describe('validateVersion', () => {
  it.each(['v1', 'v2', 'v0alpha1', 'v1beta2'])('accepts %s', (v) => {
    expect(validateVersion(v)).toBe(true);
  });

  it.each(['1', 'alpha1', '', 'V1', 'v', 'v1.0'])('rejects %s', (v) => {
    expect(validateVersion(v)).toEqual(expect.stringContaining('Version should be'));
  });
});
