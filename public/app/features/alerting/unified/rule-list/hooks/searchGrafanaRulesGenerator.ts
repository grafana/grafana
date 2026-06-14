import { useCallback } from 'react';

import {
  type GetSearchRulesApiArg,
  useLazyGetSearchRulesQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { type RulesFilter } from '../../search/rulesSearchParser';
import { getDatasourceAPIUid } from '../../utils/datasource';

import { type RuleSearchHit, mapRuleHitToDTO } from './searchRuleToPromRule';
import { type GrafanaRuleWithOrigin } from './useFilteredRulesIterator';

const SEARCH_PAGE_SIZE = 24;

/**
 * Provides a factory that builds an async generator over the cross-kind k8s `/search`
 * endpoint for Grafana-managed rules. Each yielded page is the mapped, origin-wrapped
 * batch of rules. Server-side filtering covers most of {@link RulesFilter}; runtime-only
 * filters (state/health) and policy/plugin filters are ignored (search hits are
 * definition-only).
 */
export function useSearchGrafanaRulesGenerator() {
  const [triggerSearch] = useLazyGetSearchRulesQuery();

  return useCallback(
    (filter: RulesFilter, folderTitleByUid: Map<string, string>) =>
      searchRulesGenerator(
        (args) => triggerSearch(args).unwrap(),
        filter,
        folderTitleByUid
      ),
    [triggerSearch]
  );
}

async function* searchRulesGenerator(
  search: (args: GetSearchRulesApiArg) => Promise<{ items?: RuleSearchHit[]; metadata?: { continue?: string } }>,
  filter: RulesFilter,
  folderTitleByUid: Map<string, string>
): AsyncGenerator<GrafanaRuleWithOrigin[]> {
  const baseArgs = buildSearchArgs(filter, folderTitleByUid);

  let continueToken: string | undefined;
  do {
    const args = { ...baseArgs, limit: String(SEARCH_PAGE_SIZE), continueToken };
    const response = await search(args);
    const hits = response.items ?? [];
    continueToken = response.metadata?.continue;

    yield hits.map((hit) => mapHitToGrafanaRuleWithOrigin(hit, folderTitleByUid));
  } while (continueToken);
}

function mapHitToGrafanaRuleWithOrigin(
  hit: RuleSearchHit,
  folderTitleByUid: Map<string, string>
): GrafanaRuleWithOrigin {
  const folderUid = hit.folder;
  const groupIdentifier: GrafanaRuleGroupIdentifier = {
    namespace: { uid: folderUid },
    groupName: hit.group ?? '',
    groupOrigin: 'grafana',
  };

  return {
    rule: mapRuleHitToDTO(hit),
    groupIdentifier,
    namespaceName: folderTitleByUid.get(folderUid) ?? folderUid,
    origin: 'grafana',
  };
}

/**
 * Translates a {@link RulesFilter} into `/search` query params. Multi-value params
 * (`folders`/`groups`/`labels`/`datasourceUIDs`) are passed as arrays — the generated arg
 * type narrows them to `string`, but backendSrv serializes arrays as repeated query params,
 * which the endpoint reads as OR-membership.
 */
function buildSearchArgs(filter: RulesFilter, folderTitleByUid: Map<string, string>): GetSearchRulesApiArg {
  const args: Record<string, unknown> = { sort: 'title' };

  const q = [...filter.freeFormWords, filter.ruleName].filter(Boolean).join(' ');
  if (q) {
    args.q = q;
  }
  if (filter.groupName) {
    args.groups = [filter.groupName];
  }
  if (filter.labels.length > 0) {
    args.labels = filter.labels;
  }
  if (filter.ruleType) {
    args.type = filter.ruleType === PromRuleType.Recording ? 'recordingrule' : 'alertrule';
  }
  if (filter.dashboardUid) {
    args.dashboardUid = filter.dashboardUid;
  }
  if (filter.contactPoint) {
    args.receiver = filter.contactPoint;
  }

  const datasourceUids = resolveDatasourceUids(filter.dataSourceNames);
  if (datasourceUids.length > 0) {
    args.datasourceUiDs = datasourceUids;
  }

  const folderUids = resolveNamespaceFolderUids(filter.namespace, folderTitleByUid);
  if (folderUids.length > 0) {
    args.folders = folderUids;
  }

  // The generated arg type narrows multi-value params to `string`, but backendSrv serializes
  // arrays as repeated query params, which the endpoint reads as OR-membership.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return args as GetSearchRulesApiArg;
}

function resolveDatasourceUids(dataSourceNames: string[]): string[] {
  return dataSourceNames.reduce<string[]>((acc, name) => {
    try {
      acc.push(getDatasourceAPIUid(name));
    } catch {
      // Skip names that don't resolve to a known data source.
    }
    return acc;
  }, []);
}

function resolveNamespaceFolderUids(namespace: string | undefined, folderTitleByUid: Map<string, string>): string[] {
  if (!namespace) {
    return [];
  }
  const needle = namespace.toLowerCase();
  const uids: string[] = [];
  for (const [uid, title] of folderTitleByUid) {
    if (title.toLowerCase().includes(needle)) {
      uids.push(uid);
    }
  }
  return uids;
}
