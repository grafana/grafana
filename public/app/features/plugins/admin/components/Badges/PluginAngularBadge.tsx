import * as React from 'react';

import { Badge } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export function PluginAngularBadge(): React.ReactElement {
  return (
    <Badge
      icon="exclamation-triangle"
      text={t('plugins.plugin-angular-badge.text-angular', 'Angular')}
      color="orange"
      tooltip="This plugin uses deprecated functionality, support for which is being removed."
    />
  );
}
