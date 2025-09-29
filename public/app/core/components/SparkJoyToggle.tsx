import { memo } from 'react';

import { t } from '@grafana/i18n';
import { Switch } from '@grafana/ui';

type SparkJoyToggleProps = {
  value: boolean;
  onToggle: () => void;
  className?: string;
};

export const SparkJoyToggle = memo(function SparkJoyToggle({ value, onToggle, className }: SparkJoyToggleProps) {
  return (
    <Switch
      key="sparks-joy-toggle"
      value={value}
      name="Spark joy"
      onChange={onToggle}
      aria-label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
      label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
      className={className}
    />
  );
});

export default SparkJoyToggle;
