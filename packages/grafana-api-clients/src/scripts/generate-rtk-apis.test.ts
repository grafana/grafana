import { withoutPerResourceSearch, type OperationDefinition } from './generate-rtk-apis';

const operation = (path: string) => ({ path }) as OperationDefinition;

describe('withoutPerResourceSearch', () => {
  const filter = withoutPerResourceSearch();
  const include = (path: string) => (typeof filter === 'function' ? filter('anyName', operation(path)) : false);

  it('drops the per-resource search and trash endpoints', () => {
    expect(include('/dashboards/search')).toBe(false);
    expect(include('/folders/search')).toBe(false);
    expect(include('/users/trash')).toBe(false);
  });

  // The dashboard search at the group root is a different, older endpoint that the
  // frontend does call.
  it('keeps the group-root search', () => {
    expect(include('/search')).toBe(true);
    expect(include('/search/sortable')).toBe(true);
  });

  it('keeps everything else', () => {
    expect(include('/dashboards')).toBe(true);
    expect(include('/dashboards/{name}')).toBe(true);
    expect(include('/namespaces/{namespace}/dashboards/search/other')).toBe(true);
  });

  it('leaves a whitelist alone, since it already excludes what it does not name', () => {
    expect(withoutPerResourceSearch(['getSession'])).toEqual(['getSession']);
  });

  it('keeps a caller-supplied filter as well as its own', () => {
    const onlyDashboards = withoutPerResourceSearch((_name, op) => op.path.startsWith('/dashboards'));
    if (typeof onlyDashboards !== 'function') {
      throw new Error('expected a function');
    }

    expect(onlyDashboards('anyName', operation('/dashboards'))).toBe(true);
    expect(onlyDashboards('anyName', operation('/folders'))).toBe(false);
    expect(onlyDashboards('anyName', operation('/dashboards/search'))).toBe(false);
  });
});
