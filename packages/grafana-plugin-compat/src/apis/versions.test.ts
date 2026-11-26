import { compareAPIVersions, selectAPIVersion } from './versions';

describe('compareAPIVersions', () => {
  it('sorts versions from most to least stable', () => {
    const versions = ['v0alpha1', 'v1alpha1', 'v2', 'v1beta1', 'v1', 'v2beta1', 'v1beta2', 'v1alpha2'];

    expect([...versions].sort(compareAPIVersions)).toEqual([
      'v2',
      'v1',
      'v2beta1',
      'v1beta2',
      'v1beta1',
      'v1alpha2',
      'v1alpha1',
      'v0alpha1',
    ]);
  });

  it('sorts versions that do not follow the Kubernetes pattern last, alphabetically', () => {
    expect(['foo', 'v1alpha1', 'bar', 'v1'].sort(compareAPIVersions)).toEqual(['v1', 'v1alpha1', 'bar', 'foo']);
  });
});

describe('selectAPIVersion', () => {
  const group = {
    group: 'dashboard.grafana.app',
    versions: ['v1beta1', 'v0alpha1', 'v2beta1'],
    preferredVersion: 'v1beta1',
  };

  it("returns the server's preferred version when the caller supports it", () => {
    expect(selectAPIVersion(group, ['v0alpha1', 'v2beta1', 'v1beta1'])).toBe('v1beta1');
  });

  it('returns the most stable common version when the caller does not support the preferred one', () => {
    expect(selectAPIVersion(group, ['v0alpha1', 'v2beta1'])).toBe('v2beta1');
  });

  it('ignores the order of the supported versions', () => {
    expect(selectAPIVersion(group, ['v2beta1', 'v0alpha1'])).toBe('v2beta1');
    expect(selectAPIVersion(group, ['v0alpha1', 'v2beta1'])).toBe('v2beta1');
  });

  it('returns undefined when the caller and the server have no version in common', () => {
    expect(selectAPIVersion(group, ['v1', 'v2'])).toBeUndefined();
    expect(selectAPIVersion(group, [])).toBeUndefined();
  });
});
