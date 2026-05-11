import { t } from '@grafana/i18n';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { getAnnotation } from 'app/features/alerting/unified/utils/k8s/utils';

import { type ContactPointWithMetadata } from '../../components/contact-points/utils';
import { createRelativeUrl } from '../../utils/url';

/**
 * Policy/rule usage strings and filter URLs for a Grafana-managed contact point (alert instance drawer).
 * Counts come from K8s receiver usage annotations, not the legacy alertmanager config `policies` list.
 */
export function useContactPointUsageSummary(contactPoint: ContactPointWithMetadata) {
  const { name } = contactPoint;

  const numberOfPolicies = Number(getAnnotation(contactPoint, K8sAnnotations.InUseRoutes)) || 0;
  const numberOfRules = Number(getAnnotation(contactPoint, K8sAnnotations.InUseRules)) || 0;

  const policiesSentence = t('alerting.contact-points.used-by', 'Used by {{count}} notification policies', {
    count: numberOfPolicies,
  });

  const rulesSentence = t('alerting.contact-points.used-by-rules', 'Used by {{count}} alert rules', {
    count: numberOfRules,
  });

  const policiesHref = numberOfPolicies > 0 ? createRelativeUrl('/alerting/routes', { contactPoint: name }) : null;

  const rulesHref =
    numberOfRules > 0 ? createRelativeUrl('/alerting/list', { search: `contactPoint:"${name}"` }) : null;

  return {
    policiesHref,
    rulesHref,
    policiesSentence,
    rulesSentence,
  };
}
