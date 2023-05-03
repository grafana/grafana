import { FeatureDescription } from 'react-enable/dist/FeatureState';

export enum AlertingFeature {
  NotificationPoliciesV2MatchingInstances = 'notification-policies.v2.matching-instances',
  DetailsViewV2 = "details-view.v2"
}

const FEATURES: FeatureDescription[] = [
  {
    name: AlertingFeature.NotificationPoliciesV2MatchingInstances,
    defaultValue: false,
  },
  {
    name: AlertingFeature.DetailsViewV2,
    defaultValue: false,
  },
];

export default FEATURES;
