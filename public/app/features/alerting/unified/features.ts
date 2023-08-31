import { FeatureDescription } from 'react-enable/dist/FeatureState';

import { config } from '@grafana/runtime';

export enum AlertingFeature {
  NotificationPoliciesV2MatchingInstances = 'notification-policies.v2.matching-instances',
  DetailsViewV2 = 'details-view.v2',
  ContactPointsV2 = 'contact-points.v2',
}

const FEATURES: FeatureDescription[] = [
  {
    name: AlertingFeature.NotificationPoliciesV2MatchingInstances,
    defaultValue: config.featureToggles.alertingNotificationsPoliciesMatchingInstances,
  },
  {
    name: AlertingFeature.ContactPointsV2,
    defaultValue: false,
  },
  {
    name: AlertingFeature.DetailsViewV2,
    defaultValue: false,
  },
];
export default FEATURES;
