import { FeatureDescription } from 'react-enable/dist/FeatureState';

export enum AlertingFeature {
  NotificationPoliciesV2MatchingInstances = 'notification-policies.v2.matching-instances',
}

const FEATURES: FeatureDescription[] = [
  {
    name: AlertingFeature.NotificationPoliciesV2MatchingInstances,
    defaultValue: false,
  },
];

export default FEATURES;
