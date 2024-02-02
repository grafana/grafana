import React from 'react';

import { Badge } from '@grafana/ui';

export const UnusedContactPointBadge = () => (
  <Badge
    text="Unused"
    aria-label="unused"
    color="orange"
    icon="exclamation-triangle"
    tooltip="This contact point is not used in any notification policy and it will not receive any alerts"
  />
);
