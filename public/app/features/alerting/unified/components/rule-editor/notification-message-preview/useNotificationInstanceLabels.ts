import { useCallback, useEffect, useMemo } from 'react';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { type RuleFormValues } from '../../../types/rule-form';
import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';

function stripInternalLabels(labels: Record<string, string>): Record<string, string> {
  const { [NAMED_ROOT_LABEL_NAME]: _, ...rest } = labels;
  return rest;
}

export function useNotificationInstanceLabels(
  formValues: Pick<RuleFormValues, 'queries' | 'condition' | 'folder' | 'labels' | 'name' | 'annotations'>
) {
  const { queries, condition, folder, labels, name, annotations } = formValues;
  const [trigger, { data = [], isLoading, isUninitialized }] = alertRuleApi.endpoints.preview.useMutation();

  const canPreview = Boolean(condition && folder?.uid && queries.length > 0);

  const refreshRulePreview = useCallback(() => {
    if (!canPreview || !condition || !folder) {
      return;
    }

    trigger({
      alertQueries: queries,
      condition,
      folder,
      customLabels: labels ?? [],
      annotations: annotations ?? [],
      alertName: name,
    });
  }, [annotations, canPreview, condition, folder, labels, name, queries, trigger]);

  useEffect(() => {
    refreshRulePreview();
  }, [refreshRulePreview]);

  const instanceLabels = useMemo(() => {
    const firstInstance = data.find((instance) => instance.labels);
    if (!firstInstance?.labels) {
      return undefined;
    }
    return stripInternalLabels(firstInstance.labels);
  }, [data]);

  return {
    previewInstances: data,
    instanceLabels,
    isLoading: canPreview && (isLoading || isUninitialized),
    canPreview,
    refreshRulePreview,
  };
}
