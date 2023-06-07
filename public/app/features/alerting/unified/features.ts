import { FeatureDescription } from 'react-enable/dist/FeatureState';

import { config } from '@grafana/runtime';

export enum AlertingFeature {
  NotificationPoliciesV2MatchingInstances = 'notification-policies.v2.matching-instances',
}

const FEATURES: FeatureDescription[] = [
  {
    name: AlertingFeature.NotificationPoliciesV2MatchingInstances,
    defaultValue: config.featureToggles.alertingNotificationsPoliciesMatchingInstances,
  },
];
export default FEATURES;
