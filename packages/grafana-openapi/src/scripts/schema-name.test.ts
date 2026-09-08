import { buildSchemaNameMap, escapeJsonPointer, simplifySchemaName, unescapeJsonPointer } from './schema-name';

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

describe('buildSchemaNameMap', () => {
  const dashboardSearchResults = 'com.github.grafana.grafana.pkg.apis.dashboard.v0alpha1.SearchResults';
  const searchSearchResults = 'com.github.grafana.grafana.pkg.apis.search.v0alpha1.SearchResults';
  const provisioningResourceRef =
    'com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ResourceRef';
  const searchResourceRef = 'com.github.grafana.grafana.pkg.apis.search.v0alpha1.ResourceRef';

  it('publishes every schema under its simplified name when nothing clashes', () => {
    const names = buildSchemaNameMap(
      [searchSearchResults, 'io.k8s.apimachinery.pkg.apis.meta.v1.Time'],
      'dashboard.grafana.app'
    );

    expect(Object.fromEntries(names)).toEqual({
      [searchSearchResults]: 'SearchResults',
      'io.k8s.apimachinery.pkg.apis.meta.v1.Time': 'Time',
    });
  });

  it("gives the plain name to the imported schema and qualifies the group's own", () => {
    const names = buildSchemaNameMap([dashboardSearchResults, searchSearchResults], 'dashboard.grafana.app');

    expect(names.get(searchSearchResults)).toBe('SearchResults');
    expect(names.get(dashboardSearchResults)).toBe('DashboardSearchResults');
  });

  it('matches a group against its package even when the names differ', () => {
    // Group 'provisioning.grafana.app' is served from a package called 'provisioning',
    // so its ResourceRef is the one that gets qualified.
    const names = buildSchemaNameMap([provisioningResourceRef, searchResourceRef], 'provisioning.grafana.app');

    expect(names.get(searchResourceRef)).toBe('ResourceRef');
    expect(names.get(provisioningResourceRef)).toBe('ProvisioningResourceRef');
  });

  it('qualifies a hand-registered short name with the group it is published under', () => {
    const names = buildSchemaNameMap(['SearchResults', searchSearchResults], 'dashboard.grafana.app');

    expect(names.get(searchSearchResults)).toBe('SearchResults');
    expect(names.get('SearchResults')).toBe('DashboardSearchResults');
  });

  it('keeps a hand-registered short name when there is no group to qualify it with', () => {
    const names = buildSchemaNameMap(['SearchResults', searchSearchResults]);

    expect(names.get('SearchResults')).toBe('SearchResults');
    expect(names.get(searchSearchResults)).toBe('SearchSearchResults');
  });

  it('does not depend on the order the keys arrive in', () => {
    const keys = [dashboardSearchResults, searchSearchResults, 'io.k8s.apimachinery.pkg.apis.meta.v1.Time'];
    const forwards = buildSchemaNameMap(keys, 'dashboard.grafana.app');
    const backwards = buildSchemaNameMap([...keys].reverse(), 'dashboard.grafana.app');

    expect(Object.fromEntries(backwards)).toEqual(Object.fromEntries(forwards));
  });

  it('spells out the whole path for a third-party schema, whose own package says little', () => {
    const names = buildSchemaNameMap(
      [
        'io.k8s.apimachinery.pkg.apis.meta.v1.Condition',
        'com.github.grafana.grafana.pkg.apis.alerting.v0alpha1.Condition',
      ],
      'alerting.grafana.app'
    );

    expect(names.get('com.github.grafana.grafana.pkg.apis.alerting.v0alpha1.Condition')).toBe('AlertingCondition');
    expect(names.get('io.k8s.apimachinery.pkg.apis.meta.v1.Condition')).toBe('Condition');
  });

  it('separates three schemas that all simplify to the same name', () => {
    const names = buildSchemaNameMap(
      ['SearchResults', dashboardSearchResults, searchSearchResults],
      'dashboard.grafana.app'
    );

    expect(new Set(names.values()).size).toBe(3);
    expect(names.get(searchSearchResults)).toBe('SearchResults');
  });
});
