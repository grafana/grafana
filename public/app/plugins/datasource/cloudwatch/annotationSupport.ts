import { AnnotationQuery } from '@grafana/data';

import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import { isCloudWatchAnnotation } from './guards';
import { CloudWatchAnnotationQuery, CloudWatchQuery, LegacyAnnotationQuery } from './types';

export const CloudWatchAnnotationSupport = {
  // converts legacy angular style queries to new format. Also sets the same default values as in the deprecated angular directive
  prepareAnnotation: (
    query: AnnotationQuery<CloudWatchAnnotationQuery>
  ): AnnotationQuery<CloudWatchAnnotationQuery> => {
    if (isCloudWatchAnnotation(query)) {
      return query;
    }

    const legacyQuery: LegacyAnnotationQuery = query;

    return {
      // setting AnnotationQuery props explicitly since spreading would incorrectly use props that should be on the target only
      datasource: legacyQuery.datasource,
      enable: legacyQuery.enable,
      iconColor: legacyQuery.iconColor,
      name: legacyQuery.name,
      builtIn: legacyQuery.builtIn,
      hide: legacyQuery.hide,
      target: {
        ...legacyQuery.target,
        ...legacyQuery,
        statistic: legacyQuery.statistic || 'Average',
        region: legacyQuery.region || 'default',
        queryMode: 'Annotations',
        refId: legacyQuery.refId || 'annotationQuery',
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
  QueryEditor: AnnotationQueryEditor,
};
