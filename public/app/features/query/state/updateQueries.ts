import { CoreApp, DataSourceApi, getNextRefId, hasQueryExportSupport, hasQueryImportSupport } from '@grafana/data';
import { getTemplateSrv, isExpressionReference } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

export async function updateQueries(
  nextDS: DataSourceApi,
  nextDSUidOrVariableExpression: string,
  queries: DataQuery[],
  currentDS?: DataSourceApi
): Promise<DataQuery[]> {
  let nextQueries = queries;
  const datasource = { ...nextDS.getRef(), uid: nextDSUidOrVariableExpression };
  const DEFAULT_QUERY = { ...nextDS?.getDefaultQuery?.(CoreApp.PanelEditor), datasource, refId: 'A' };

  // we are changing data source type
  if (currentDS?.meta.id !== nextDS.meta.id) {
    // If changing to mixed do nothing
    if (nextDS.meta.mixed) {
      return queries;
    }
    // when both data sources support abstract queries
    else if (hasQueryExportSupport(currentDS) && hasQueryImportSupport(nextDS)) {
      const abstractQueries = await currentDS.exportToAbstractQueries(queries);
      nextQueries = await nextDS.importFromAbstractQueries(abstractQueries);
    }
    // when datasource supports query import
    else if (currentDS && nextDS.importQueries) {
      nextQueries = await nextDS.importQueries(queries, currentDS);
    }
    // Otherwise clear queries that do not match the next datasource UID
    else {
      if (currentDS) {
        const templateSrv = getTemplateSrv();
        const reducedQueries: DataQuery[] = [];
        let nextUid = nextDS.uid;
        const nextIsTemplate = templateSrv.containsTemplate(nextDSUidOrVariableExpression);
        if (nextIsTemplate) {
          nextUid = templateSrv.replace(nextDS.uid);
        }
        // Queries will only be preserved if the datasource UID of the query matches the UID
        // of the next chosen datasource
        const nextDsQueries = queries.reduce((reduced, currentQuery) => {
          if (currentQuery.datasource) {
            let currUid = currentQuery.datasource.uid;
            const currIsTemplate = templateSrv.containsTemplate(currUid);
            if (currIsTemplate) {
              currUid = templateSrv.replace(currentQuery.datasource.uid);
            }
            if (currUid === nextUid && currIsTemplate === nextIsTemplate) {
              currentQuery.refId = getNextRefId(reduced);
              return reduced.concat([currentQuery]);
            }
          }
          return reduced;
        }, reducedQueries);

        if (nextDsQueries.length > 0) {
          return nextDsQueries;
        }
      }

      return [DEFAULT_QUERY];
    }
  }

  if (nextQueries.length === 0) {
    return [DEFAULT_QUERY];
  }

  // Set data source on all queries except expression queries
  return nextQueries.map((query) => {
    if (!isExpressionReference(query.datasource) && !nextDS.meta.mixed) {
      query.datasource = datasource;
    }
    return query;
  });
}
