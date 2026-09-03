import { escapeJsonPointer, simplifySchemaName, unescapeJsonPointer } from './schema-name';

describe('unescapeJsonPointer', () => {
  it('reverses slash and tilde escaping', () => {
    expect(unescapeJsonPointer('github.com~1grafana~1grafana')).toBe('github.com/grafana/grafana');
    expect(unescapeJsonPointer('a~0b')).toBe('a~b');
  });

  it('leaves names without escape sequences untouched', () => {
    expect(unescapeJsonPointer('io.k8s.apimachinery.pkg.apis.meta.v1.Time')).toBe(
      'io.k8s.apimachinery.pkg.apis.meta.v1.Time'
    );
  });
});

describe('escapeJsonPointer', () => {
  it('escapes slashes and tildes', () => {
    expect(escapeJsonPointer('github.com/grafana/grafana')).toBe('github.com~1grafana~1grafana');
    expect(escapeJsonPointer('a~b')).toBe('a~0b');
  });

  it('round-trips with unescapeJsonPointer', () => {
    const name = 'github.com/grafana/grafana/pkg/apis/iam/v0alpha1.TeamMemberList';
    expect(unescapeJsonPointer(escapeJsonPointer(name))).toBe(name);
  });
});

describe('simplifySchemaName', () => {
  it('strips the version prefix from a canonical dotted name', () => {
    expect(simplifySchemaName('io.k8s.apimachinery.pkg.apis.meta.v1.Time')).toBe('Time');
  });

  it('returns the name unchanged when no version segment is present', () => {
    expect(simplifySchemaName('io.k8s.apimachinery.pkg.util.intstr.IntOrString')).toBe(
      'io.k8s.apimachinery.pkg.util.intstr.IntOrString'
    );
  });

  it('returns a raw Go import path unescaped but otherwise unchanged, matching its plain form', () => {
    // The embedded '/' characters prevent the version regex from matching a clean
    // '.'-separated segment, so the name passes through - but consistently, whether
    // it arrived escaped (as kube-openapi now emits it) or plain.
    const plain = 'github.com/grafana/grafana/pkg/apis/iam/v0alpha1.TeamMemberList';
    const escaped = 'github.com~1grafana~1grafana~1pkg~1apis~1iam~1v0alpha1.TeamMemberList';
    expect(simplifySchemaName(escaped)).toBe(plain);
    expect(simplifySchemaName(plain)).toBe(plain);
  });
});
