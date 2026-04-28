import { t } from '@grafana/i18n';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { getAnnotation, shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';

import { type ContactPointWithMetadata } from '../../components/contact-points/utils';
import { createRelativeUrl } from '../../utils/url';

/**
 * Copy for policy / rule usage lines and link targets for the instance drawer.
 */
export function useContactPointUsageSummary(contactPoint: ContactPointWithMetadata) {
  const { selectedAlertmanager } = useAlertmanager();
  const usingK8sApi = shouldUseK8sApi(selectedAlertmanager!);

  const { name, policies = [] } = contactPoint;

  const k8sRoutesInUse = getAnnotation(contactPoint, K8sAnnotations.InUseRoutes);
  const numberOfPolicies = usingK8sApi ? Number(k8sRoutesInUse) : policies.length;
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
