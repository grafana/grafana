import { AnnotationQuery } from '@grafana/data';

import { AzureMonitorQuery, AzureQueryType } from '../types';

// The old Angular annotations editor put some properties (rawQuery, workspace, subscription)
// on the root annotation object, rather than down in the 'targets' query value
// This migration moves them to a Log Analytics query compatible with the React query editor
// The old Angular annotations editor did not support any other query types.
export default function migrateAnnotation(annotation: AnnotationQuery<AzureMonitorQuery>) {
  const oldQuery = typeof annotation.rawQuery === 'string' ? annotation.rawQuery : null;
  const oldWorkspace = typeof annotation.workspace === 'string' ? annotation.workspace : null;

  if (!(oldQuery && oldWorkspace && !annotation.target?.azureLogAnalytics?.query)) {
    return annotation;
  }

  const newQuery: AzureMonitorQuery = {
    ...(annotation.target ?? {}),
    refId: annotation.target?.refId ?? 'Anno',
    queryType: AzureQueryType.LogAnalytics,
    azureLogAnalytics: {
      query: oldQuery,
      resource: oldWorkspace,
    },
  };

  return {
    ...annotation,
    rawQuery: undefined,
    workspace: undefined,
    subscription: undefined,
    queryType: undefined,
    target: newQuery,
  };
}
