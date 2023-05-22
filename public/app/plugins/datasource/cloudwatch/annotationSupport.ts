import { AnnotationQuery } from '@grafana/data';

import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import { DEFAULT_ANNOTATIONS_QUERY } from './defaultQueries';
import { isCloudWatchAnnotation } from './guards';
import { CloudWatchAnnotationQuery, CloudWatchQuery, LegacyAnnotationQuery } from './types';

export const CloudWatchAnnotationSupport = {
  // converts legacy angular style queries to new format. Also sets the same default values as in the deprecated angular directive
  prepareAnnotation: (
    query: LegacyAnnotationQuery | AnnotationQuery<CloudWatchAnnotationQuery>
  ): AnnotationQuery<CloudWatchAnnotationQuery> => {
    if (isCloudWatchAnnotation(query)) {
      return query;
    }

    return {
      // setting AnnotationQuery props explicitly since spreading would incorrectly use props that should be on the target only
      datasource: query.datasource,
      enable: query.enable,
      iconColor: query.iconColor,
      name: query.name,
      builtIn: query.builtIn,
      hide: query.hide,
      target: {
        ...query.target,
        ...query,
        statistic: query.statistic || DEFAULT_ANNOTATIONS_QUERY.statistic,
        region: query.region || DEFAULT_ANNOTATIONS_QUERY.region,
        queryMode: 'Annotations',
        refId: query.refId || 'annotationQuery',
      },
    };
  },
  // return undefined if query is not complete so that annotation query execution is quietly skipped
  prepareQuery: (anno: AnnotationQuery<CloudWatchAnnotationQuery>): CloudWatchQuery | undefined => {
    if (!anno.target) {
      return undefined;
    }

    const {
      prefixMatching,
      actionPrefix,
      alarmNamePrefix,
      statistic,
      namespace,
      metricName,
      dimensions = {},
    } = anno.target;
    const validPrefixMatchingQuery = !!prefixMatching && !!actionPrefix && !!alarmNamePrefix;
    const validMetricStatQuery =
      !prefixMatching && !!namespace && !!metricName && !!statistic && !!Object.values(dimensions).length;

    if (validPrefixMatchingQuery || validMetricStatQuery) {
      return anno.target;
    }

    return undefined;
  },
  getDefaultQuery() {
    return DEFAULT_ANNOTATIONS_QUERY;
  },
  QueryEditor: AnnotationQueryEditor,
};
