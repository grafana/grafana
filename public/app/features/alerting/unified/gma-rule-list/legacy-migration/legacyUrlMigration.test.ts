import { reportInteraction } from '@grafana/runtime';

import { logWarning } from '../../Analytics';

import { migrateLegacyRuleListUrl, parseLegacyRuleListParams } from './legacyUrlMigration';
import { type NameResolvers } from './migrationResolve';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('../../Analytics', () => ({
  ...jest.requireActual('../../Analytics'),
  logWarning: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);
const logWarningMock = jest.mocked(logWarning);

function resolvers(overrides: Partial<NameResolvers> = {}): NameResolvers {
  return {
    resolveFolderUidByName: jest.fn(async () => 'resolved-folder-uid'),
    resolveDataSourceUidByName: jest.fn(async () => 'resolved-ds-uid'),
    ...overrides,
  };
}

describe('parseLegacyRuleListParams', () => {
  it('SEARCH-M1: reads the recognized legacy params out of a query string', () => {
    expect(
      parseLegacyRuleListParams(
        '?search=cpu&view=list&dataSource=ds-1&alertState=firing&ruleType=recording&queryString=old'
      )
    ).toEqual({
      search: 'cpu',
      view: 'list',
      dataSource: 'ds-1',
      alertState: 'firing',
      ruleType: 'recording',
      queryString: 'old',
    });
  });
});

describe('migrateLegacyRuleListUrl', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    logWarningMock.mockClear();
  });

  function legacyLocation(query: Record<string, string>) {
    return { search: new URLSearchParams(query).toString() };
  }

  it('NAV-4.5: resolves a legacy folder name to its UID and builds the destination URL', async () => {
    const result = await migrateLegacyRuleListUrl(
      legacyLocation({ search: 'namespace:"My Folder"' }),
      resolvers({
        resolveFolderUidByName: jest.fn(async (name) => (name === 'My Folder' ? 'folder-uid-1' : undefined)),
      })
    );

    expect(result.pathname).toBe('/alerting/rules/alert');
    expect(new URLSearchParams(result.search).get('search')).toBe('namespace:folder-uid-1');
    expect(result.diagnostics.droppedKeys).toEqual([]);
  });

  it('NAV-4.6: removes an unresolved folder name from the destination and reports its key', async () => {
    const result = await migrateLegacyRuleListUrl(
      legacyLocation({ search: 'namespace:unknown-folder cpu' }),
      resolvers({ resolveFolderUidByName: jest.fn(async () => undefined) })
    );

    expect(new URLSearchParams(result.search).get('search')).toBe('cpu');
    expect(result.diagnostics.droppedKeys).toEqual(['namespace']);
  });

  it('NAV-4.18: still redirects, dropping the filter, when the name lookup fails', async () => {
    const result = await migrateLegacyRuleListUrl(
      legacyLocation({ search: 'namespace:Team datasource:Prom cpu' }),
      resolvers({
        resolveFolderUidByName: jest.fn().mockRejectedValue(new Error('500')),
        resolveDataSourceUidByName: jest.fn().mockRejectedValue(new Error('403')),
      })
    );

    expect(result.pathname).toBe('/alerting/rules/alert');
    expect(new URLSearchParams(result.search).get('search')).toBe('cpu');
    expect(result.diagnostics.droppedKeys).toEqual(['datasource', 'namespace']);
  });

  it('NAV-4.19: still redirects and drops malformed and unknown parameters', async () => {
    const result = await migrateLegacyRuleListUrl(
      legacyLocation({ search: 'state:bogus nonsense:1 cpu label:"unterminated', view: 'bogus' }),
      resolvers()
    );

    expect(result.pathname).toBe('/alerting/rules/alert');
    expect(new URLSearchParams(result.search).get('search')).toBe('cpu');
    expect(result.diagnostics.droppedKeys).toEqual(['label', 'nonsense', 'state']);
  });

  it('NAV-4.7: emits the migration analytics event once, with only sorted filter-key names', async () => {
    await migrateLegacyRuleListUrl(legacyLocation({ dataSource: 'my-ds', search: 'group:g1' }), resolvers());

    expect(reportInteractionMock).toHaveBeenCalledTimes(1);
    expect(reportInteractionMock).toHaveBeenCalledWith('grafana_alerting_gma_list_query_migration', {
      migrated_filter_keys: 'dataSource',
      dropped_filter_keys: 'group',
    });
  });

  it('NAV-4.8: does not emit the analytics event when nothing was migrated or dropped', async () => {
    await migrateLegacyRuleListUrl(legacyLocation({ search: 'cpu' }), resolvers());
    expect(reportInteractionMock).not.toHaveBeenCalled();
  });

  it('NAV-4.20: reports a user-typed filter name as other in analytics and logs, never as typed', async () => {
    await migrateLegacyRuleListUrl(legacyLocation({ search: 'secret-team-name:1 cpu' }), resolvers());

    expect(reportInteractionMock).toHaveBeenCalledWith('grafana_alerting_gma_list_query_migration', {
      migrated_filter_keys: '',
      dropped_filter_keys: 'other',
    });
    expect(logWarningMock).toHaveBeenCalledWith(expect.any(String), { filterKey: 'other' });
  });

  it('NAV-4.9: logs a warning with only the filter key name for each dropped filter', async () => {
    await migrateLegacyRuleListUrl(legacyLocation({ search: 'type:recording dashboard:dash-1' }), resolvers());

    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledWith(expect.any(String), { filterKey: 'dashboard' });
  });

  it('NAV-4.10: routes recording destinations to the Recording path', async () => {
    const result = await migrateLegacyRuleListUrl(legacyLocation({ ruleType: 'recording' }), resolvers());
    expect(result.pathname).toBe('/alerting/rules/recording');
  });
});
