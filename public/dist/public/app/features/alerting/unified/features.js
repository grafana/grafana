import { config } from '@grafana/runtime';
export var AlertingFeature;
(function (AlertingFeature) {
    AlertingFeature["NotificationPoliciesV2MatchingInstances"] = "notification-policies.v2.matching-instances";
    AlertingFeature["DetailsViewV2"] = "details-view.v2";
    AlertingFeature["ContactPointsV2"] = "contact-points.v2";
})(AlertingFeature || (AlertingFeature = {}));
const FEATURES = [
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
//# sourceMappingURL=features.js.map