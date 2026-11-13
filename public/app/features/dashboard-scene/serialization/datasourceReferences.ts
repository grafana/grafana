import { type AnnotationQuery } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { type QueryVariable, type SceneDataQuery, type SceneQueryRunner } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { normalizeDataSourceRef } from './normalizeDataSourceRef';

export function getDefaultDataSourceRef(): DataSourceRef {
  // we need to return the default datasource configured in the BootConfig
  const defaultDatasource = config.defaultDatasource;

  // get default datasource type
  const dsList = config.datasources;
  const ds = dsList[defaultDatasource];

  // If we can't find the default datasource, fall back to grafana
  if (!ds) {
    return { type: 'grafana', uid: '-- Grafana --' };
  }

  return { type: ds.type, uid: ds.uid };
}

export function getDefaultDatasource(): DataSourceRef {
  const defaultDataSourceRef = getDefaultDataSourceRef() ?? { type: 'grafana', uid: '-- Grafana --' };

  if (defaultDataSourceRef.uid && !defaultDataSourceRef.apiVersion) {
    // get api version from config
    const defaultDatasource = config.defaultDatasource;
    const dsInstance = config.datasources[defaultDatasource];
    defaultDataSourceRef.apiVersion = dsInstance.apiVersion ?? undefined;
  }

  return {
    apiVersion: defaultDataSourceRef.apiVersion,
    type: defaultDataSourceRef.type,
    uid: defaultDataSourceRef.uid,
  };
}

export function getDataQueryKind(query: SceneDataQuery | string | undefined, queryRunner?: SceneQueryRunner): string {
  // Handle undefined query - return default data source type
  if (query === undefined || query === null) {
    const defaultDS = getDefaultDataSourceRef();
    return defaultDS?.type || '';
  }

  // Query is a string - get default data source type
  if (typeof query === 'string') {
    const defaultDS = getDefaultDataSourceRef();
    return defaultDS?.type || '';
  }

  // If query has a datasource UID (even without type), check if it matches the queryRunner's datasource
  // Only use queryRunner's type if the UIDs match or if query has no datasource at all
  if (queryRunner?.state.datasource?.type) {
    // If query has a datasource UID that differs from queryRunner's, fall back to default
    if (query.datasource?.uid && query.datasource.uid !== queryRunner.state.datasource.uid) {
      const defaultDS = getDefaultDataSourceRef();
      return defaultDS?.type || '';
    }
    return queryRunner.state.datasource.type;
  }

  // Fall back to default datasource
  const defaultDS = getDefaultDataSourceRef();
  return defaultDS?.type || '';
}

/**
 * Resolves a datasource reference for a query.
 * @param querySpecDS - The datasource specified in the query
 * @param queryKind - The kind of query being performed (datasource type)
 * @returns The resolved DataSourceRef
 */
export function getDataSourceForQuery(querySpecDS: DataSourceRef | undefined | null, queryKind: string): DataSourceRef {
  // If datasource is specified and has a uid, use it
  if (querySpecDS?.uid) {
    return querySpecDS;
  }

  // Otherwise try to infer datasource based on query kind (kind = ds type)
  const defaultDatasource = config.defaultDatasource;
  const dsList = config.datasources;

  // First check if the default datasource matches the query type
  if (dsList && dsList[defaultDatasource] && dsList[defaultDatasource].meta.id === queryKind) {
    // In the datasource list from bootData "id" is the type and the uid could be uid or the name
    // in cases like grafana, dashboard or mixed datasource
    return {
      uid: dsList[defaultDatasource].uid || dsList[defaultDatasource].name,
      type: dsList[defaultDatasource].meta.id,
    };
  }

  // Look up by query type/kind from all available datasources
  const bestGuess = dsList && Object.values(dsList).find((ds) => ds.meta.id === queryKind);

  if (bestGuess) {
    return { uid: bestGuess.uid, type: bestGuess.meta.id };
  } else if (dsList && dsList[defaultDatasource]) {
    // Fallback to default datasource even if type doesn't match
    // In the datasource list from bootData "id" is the type and the uid could be uid or the name
    // in cases like grafana, dashboard or mixed datasource

    console.warn(
      `Could not find datasource for query kind ${queryKind}, defaulting to ${dsList[defaultDatasource].meta.id}`
    );
    return {
      uid: dsList[defaultDatasource].uid || dsList[defaultDatasource].name,
      type: dsList[defaultDatasource].meta.id,
    };
  }

  if (dsList && !dsList[defaultDatasource]) {
    throw new Error(`Default datasource ${defaultDatasource} not found in datasource list`);
  }

  // In the datasource list from bootData "id" is the type and the uid could be uid or the name
  // in cases like grafana, dashboard or mixed datasource
  return {
    uid: dsList[defaultDatasource].uid || dsList[defaultDatasource].name,
    type: dsList[defaultDatasource].meta.id,
  };
}

/**
 * Returns the datasource value that should be persisted for a panel query, variable or annotation
 * - Undefined if the datasource was not defined in the initial save model
 * - { type: string } if the datasource was autossigned defined by the initial group value
 * - { uid: string, type: string } if the datasource was defined in the initial save model
 */
export function getPersistedDSFor<T extends SceneDataQuery | QueryVariable | AnnotationQuery>(
  element: T,
  autoAssignedDsRef: Map<string, string | undefined>,

  type: 'query' | 'variable' | 'annotation',
  context?: SceneQueryRunner
): DataSourceRef | undefined {
  let datasource: DataSourceRef | undefined;

  // First, try to resolve from the element's current datasource if it has one
  if (type === 'query') {
    datasource = normalizeDataSourceRef('datasource' in element ? element.datasource : undefined);

    const panelDS = normalizeDataSourceRef(context?.state?.datasource);
    if (panelDS?.uid) {
      const notMixed = panelDS?.uid !== MIXED_DATASOURCE_NAME;
      const notExpr =
        !datasource ||
        (datasource.uid !== ExpressionDatasourceRef.uid && datasource.type !== ExpressionDatasourceRef.type);

      if (notMixed && (!datasource || (panelDS?.uid !== datasource.uid && notExpr))) {
        datasource = panelDS;
      }
    }
  }

  if (type === 'variable' && 'state' in element && 'datasource' in element.state) {
    datasource = normalizeDataSourceRef(element.state.datasource);
  }

  if (type === 'annotation' && 'datasource' in element) {
    datasource = normalizeDataSourceRef(element.datasource);
  }

  // If a datasource was resolved from the element, use it
  if (datasource) {
    return datasource;
  }

  const elementId = getElementIdentifier(element, type);
  if (autoAssignedDsRef?.has(elementId)) {
    const dsType = autoAssignedDsRef.get(elementId);
    // If the ds type was defined, return datasource with only the type; otherwise undefined
    return dsType ? { type: dsType } : undefined;
  }

  return undefined;
}

/**
 * Helper function to extract which identifier to use from a query or variable element
 * @returns refId for queries, name for variables
 * TODO: we will add annotations in the future
 */
function getElementIdentifier<T extends SceneDataQuery | QueryVariable | AnnotationQuery>(
  element: T,
  type: 'query' | 'variable' | 'annotation'
): string {
  // when is type query look for refId
  if (type === 'query') {
    return 'refId' in element ? element.refId : '';
  }

  if (type === 'variable') {
    // when is type variable look for the name of the variable
    return 'state' in element && 'name' in element.state ? element.state.name : '';
  }

  // when is type annotation look for annotation name
  if (type === 'annotation') {
    return 'name' in element ? element.name : '';
  }

  throw new Error(`Invalid type ${type} for getElementIdentifier`);
}
