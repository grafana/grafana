import { useCallback, useEffect, useMemo } from 'react';

import { type ContactPoint } from '@grafana/alerting/unstable';

import { type PreviewResponse } from '../../../api/alertRuleApi';
import { usePreviewTemplateMutation } from '../../../api/templateApi';

import {
  PREVIEW_BODY_TEMPLATE,
  PREVIEW_TITLE_TEMPLATE,
  buildContactPointPreviewTemplate,
} from './buildContactPointPreviewTemplate';
import { buildTestTemplateAlerts } from './buildTestTemplateAlerts';
import { getIntegrationPreviewTemplates } from './getIntegrationPreviewTemplates';

export function useContactPointTemplatePreview({
  contactPoint,
  integrationIndex,
  ruleName,
  annotations,
  labels,
  previewInstances,
}: {
  contactPoint?: ContactPoint;
  integrationIndex: number;
  ruleName: string;
  annotations: Record<string, string>;
  labels: Record<string, string>;
  previewInstances?: PreviewResponse;
}) {
  const [trigger, { data, error, isLoading, isUninitialized }] = usePreviewTemplateMutation();

  const integration = contactPoint?.spec.integrations?.[integrationIndex];
  const previewTemplates = useMemo(
    () => (integration ? getIntegrationPreviewTemplates(integration) : undefined),
    [integration]
  );

  const alerts = useMemo(
    () =>
      buildTestTemplateAlerts({
        ruleName,
        annotations,
        labels,
        previewInstances,
      }),
    [annotations, labels, previewInstances, ruleName]
  );

  const refreshPreview = useCallback(() => {
    if (!contactPoint || !previewTemplates) {
      return;
    }

    trigger({
      template: buildContactPointPreviewTemplate(previewTemplates),
      alerts,
      name: 'notification-message-preview',
    });
  }, [alerts, contactPoint, previewTemplates, trigger]);

  useEffect(() => {
    if (!contactPoint || !previewTemplates) {
      return;
    }

    trigger({
      template: buildContactPointPreviewTemplate(previewTemplates),
      alerts,
      name: 'notification-message-preview',
    });
  }, [alerts, contactPoint, previewTemplates, trigger]);

  const title = data?.results?.find((result) => result.name === PREVIEW_TITLE_TEMPLATE)?.text;
  const body = data?.results?.find((result) => result.name === PREVIEW_BODY_TEMPLATE)?.text;

  return {
    title,
    body,
    integrationType: previewTemplates?.integrationType,
    integrationLabel: previewTemplates?.integrationLabel,
    previewMayDifferFromDelivery: previewTemplates?.previewMayDifferFromDelivery ?? false,
    templateErrors: data?.errors,
    error,
    isLoading: Boolean(contactPoint) && (isLoading || isUninitialized),
    refreshPreview,
    canRefreshPreview: Boolean(contactPoint && previewTemplates),
  };
}
