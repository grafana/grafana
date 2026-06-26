import { AnnotationQuery, AnnotationSupport } from '@grafana/data';

import { LegacyAnnotation, OpenTsdbQuery } from './types';

// this becomes the target in the migrated annotations
const migrateLegacyAnnotation = (json: LegacyAnnotation) => {
  // return the target annotation
  const annotation: LegacyAnnotation = {
    fromAnnotations: true,
    target: json.target ?? '',
    name: json.name ?? '',
    isGlobal: json.isGlobal ?? false,
  };

  return annotation;
};

export const prepareAnnotation: AnnotationSupport<
  OpenTsdbQuery,
  AnnotationQuery<OpenTsdbQuery>
>['prepareAnnotation'] = (json) => {
  const resultingTarget = json.target && typeof json.target !== 'string' ? json.target : migrateLegacyAnnotation(json);

  json.target = resultingTarget;

  return json;
};
