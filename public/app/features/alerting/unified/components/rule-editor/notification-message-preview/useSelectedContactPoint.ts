import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { base64UrlEncode } from '@grafana/alerting';
import { type ContactPoint, notificationsAPIv0alpha1 } from '@grafana/alerting/unstable';

import { type RuleFormValues } from '../../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { stringifyFieldSelector } from '../../../utils/k8s/utils';
import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';
import { useAlertmanagerNotificationRoutingPreview } from '../notificaton-preview/useAlertmanagerNotificationRoutingPreview';

export function useResolvedContactPoint(contactPointName?: string) {
  const encodedName = contactPointName ? base64UrlEncode(contactPointName) : '';

  const { currentData, isFetching } = notificationsAPIv0alpha1.endpoints.listReceiver.useQuery(
    {
      fieldSelector: stringifyFieldSelector([['metadata.name', encodedName]]),
    },
    { skip: !contactPointName }
  );

  const contactPoint = currentData?.items.at(0) as ContactPoint | undefined;

  return {
    contactPoint,
    isLoading: Boolean(contactPointName) && isFetching,
  };
}

function usePolicyMatchedReceiverName(values: RuleFormValues, instanceLabels?: Record<string, string>) {
  const instances = useMemo(() => (instanceLabels ? [instanceLabels] : []), [instanceLabels]);

  const policyName =
    values.selectedPolicy || values.labels?.find((label) => label.key === NAMED_ROOT_LABEL_NAME)?.value?.trim();

  const canResolve = Boolean(policyName) && Boolean(instanceLabels);

  const { treeMatchingResults, isLoading } = useAlertmanagerNotificationRoutingPreview(
    GRAFANA_RULES_SOURCE_NAME,
    instances,
    policyName
  );

  const receiverName = useMemo(() => {
    for (const result of treeMatchingResults) {
      for (const { route } of result.matchedRoutes) {
        if (route.receiver) {
          return route.receiver;
        }
      }
    }
    return undefined;
  }, [treeMatchingResults]);

  return {
    receiverName,
    isLoading: canResolve && isLoading,
  };
}

/** Resolves a contact point from notification-policy routing. Renders nothing. */
export function PolicyRoutedContactPointResolver({
  instanceLabels,
  onResolved,
}: {
  instanceLabels?: Record<string, string>;
  onResolved: (name: string | undefined, isLoading: boolean) => void;
}) {
  const { watch } = useFormContext<RuleFormValues>();
  const values = watch();
  const { receiverName, isLoading } = usePolicyMatchedReceiverName(values, instanceLabels);

  useEffect(() => {
    onResolved(receiverName, isLoading);
  }, [isLoading, onResolved, receiverName]);

  return null;
}

export function useManualContactPointName() {
  const { watch } = useFormContext<RuleFormValues>();
  const manualRouting = watch('manualRouting');
  const selectedContactPoint = watch('contactPoints.grafana.selectedContactPoint');
  return manualRouting ? selectedContactPoint?.trim() || undefined : undefined;
}
