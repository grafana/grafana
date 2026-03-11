import { useEffect } from 'react';

import { createAssistantContextItem, ChatContextItem, useProvidePageContext } from '@grafana/assistant';
import { DataSourceApi } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { ExploreItemState } from 'app/types/explore';

export function useExplorePageContext(panes: Array<[string, ExploreItemState]>): void {
  const setContext = useProvidePageContext(/^\/explore/);

  useEffect(() => {
    setContext(buildContext(panes));
  }, [panes, setContext]);
}

function buildContext(panes: Array<[string, ExploreItemState]>): ChatContextItem[] {
  return panes.flatMap(([, pane]) => {
    const ds = pane.datasourceInstance;
    if (!ds) {
      return [];
    }

    // if `-- Mixed --` datasource, we add each data source individual
    if (ds.meta.mixed) {
      return buildMixedContext(pane.queries);
    }

    return buildDatasourceContext(ds.uid, ds.name, ds.meta?.info?.logos?.small, pane.queries, ds);
  });
}

function buildMixedContext(queries: DataQuery[]): ChatContextItem[] {
  const grouped = new Map<string, DataQuery[]>();
  for (const query of queries) {
    const uid = query.datasource?.uid;
    if (!uid) {
      continue;
    }
    const existing = grouped.get(uid);
    if (existing) {
      existing.push(query);
    } else {
      grouped.set(uid, [query]);
    }
  }

  const items: ChatContextItem[] = [];
  for (const [uid, dsQueries] of grouped) {
    const settings = getDataSourceSrv().getInstanceSettings(uid);
    if (!settings) {
      continue;
    }
    items.push(...buildDatasourceContext(uid, settings.name, settings.meta?.info?.logos?.small, dsQueries));
  }
  return items;
}

function buildDatasourceContext(
  uid: string,
  name: string,
  img: string | undefined,
  queries: DataQuery[],
  ds?: DataSourceApi
): ChatContextItem[] {
  const items: ChatContextItem[] = [createAssistantContextItem('datasource', { datasourceUid: uid, img })];

  const nonEmptyQueries = queries.filter((q) => !isQueryEmpty(q, ds));
  if (nonEmptyQueries.length > 0) {
    items.push(
      createAssistantContextItem('structured', {
        title: `Explore queries (${name})`,
        data: {
          queries: nonEmptyQueries.map((q) => summarizeQuery(q, ds)),
        },
      })
    );
  }

  return items;
}

// maintain these field lists to avoid passing full query objects to the assistant.
const EXPRESSION_FIELDS = new Set(['expr', 'expression', 'query', 'rawSql', 'rawQuery']);
const METADATA_FIELDS = new Set([
  'queryType',
  'format',
  'instant',
  'range',
  'legendFormat',
  'editorMode',
  'maxLines',
  'direction',
]);

function summarizeQuery(query: DataQuery, ds?: DataSourceApi): Record<string, unknown> {
  const summary: Record<string, unknown> = { refId: query.refId };

  const displayText = ds?.getQueryDisplayText?.(query);
  if (displayText) {
    summary.expression = displayText;
  }

  for (const [key, value] of Object.entries(query)) {
    if (!summary.expression && EXPRESSION_FIELDS.has(key) && value) {
      summary.expression = value;
    }
    if (METADATA_FIELDS.has(key) && value != null) {
      summary[key] = value;
    }
  }

  return summary;
}

function isQueryEmpty(query: DataQuery, ds?: DataSourceApi): boolean {
  if (ds?.getQueryDisplayText) {
    return !ds.getQueryDisplayText(query)?.trim();
  }
  const { refId, datasource, ...rest } = query;
  return Object.keys(rest).length === 0;
}
