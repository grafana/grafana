import { AnnotationQuery } from '@grafana/data';
import { AnnotationQueryKind, defaultDataQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { getRuntimePanelDataSource } from './layoutSerializers/utils';

export function transformV1ToV2AnnotationQuery(
  annotation: AnnotationQuery,

  dsType: string,
  dsUID?: string,
  // Overrides are used to provide properties based on scene's annotations data layer object state
  override?: Partial<AnnotationQuery>
): AnnotationQueryKind {
  const group = annotation.builtIn ? 'grafana' : dsType;

  const {
    // known properties documented in v1 schema
    enable,
    hide,
    iconColor,
    name,
    builtIn,
    filter,
    mappings,
    datasource,
    target,
    snapshotData,
    type,

    // unknown properties that are still available for configuration through API
    ...legacyOptions
  } = annotation;

  const result: AnnotationQueryKind = {
    kind: 'AnnotationQuery',
    spec: {
      builtIn: Boolean(annotation.builtIn),
      name: annotation.name,
      enable: Boolean(override?.enable) || Boolean(annotation.enable),
      hide: Boolean(override?.hide) || Boolean(annotation.hide),
      iconColor: annotation.iconColor,

      query: {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group, // Annotation layer has a datasource type provided in runtime.
        spec: target || {},
      },
    },
  };

  if (dsUID) {
    result.spec.query.datasource = {
      name: dsUID,
    };
  }

  // if legacy options is not an empty object, add it to the result
  if (Object.keys(legacyOptions).length > 0) {
    result.spec.legacyOptions = legacyOptions;
  }

  if (annotation.filter?.ids?.length) {
    result.spec.filter = annotation.filter;
  }

  // TODO: add mappings

  return result;
}

export function transformV2ToV1AnnotationQuery(annotation: AnnotationQueryKind): AnnotationQuery {
  let { query: dataQuery, ...annotationQuery } = annotation.spec;

  // Mapping from AnnotationQueryKind to AnnotationQuery used by scenes.
  let annoQuerySpec: AnnotationQuery = {
    enable: annotation.spec.enable,
    hide: annotation.spec.hide,
    iconColor: annotation.spec.iconColor,
    name: annotation.spec.name,
    // TOOO: mappings
  };

  if (Object.keys(dataQuery.spec).length > 0) {
    // @ts-expect-error DataQueryKind spec should be typed as DataQuery interface
    annoQuerySpec.target = {
      ...dataQuery?.spec,
    };
  }

  if (annotation.spec.builtIn) {
    annoQuerySpec.type = 'dashboard';
    annoQuerySpec.builtIn = 1;
  }

  if (annotation.spec.filter) {
    annoQuerySpec.filter = annotation.spec.filter;
  }

  // some annotations will contain in the legacyOptions properties that need to be
  // added to the root level AnnotationQuery
  if (annotationQuery.legacyOptions) {
    annoQuerySpec = {
      ...annoQuerySpec,
      ...annotationQuery.legacyOptions,
    };
  }

  // get data source from annotation query
  const datasource = getRuntimePanelDataSource(dataQuery);

  annoQuerySpec.datasource = datasource;

  return annoQuerySpec;
}
