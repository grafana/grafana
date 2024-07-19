import { Badge } from '@grafana/ui';

export const UnusedContactPointBadge = () => (
  <Badge
    text="Unused"
    aria-label="unused"
    color="orange"
    icon="exclamation-triangle"
    // is not used in any policy, but it can receive notifications from an auto auto generated policy. Non admin users can't see auto generated policies.
    tooltip="This contact point is not used in any notification policy"
  />
);
