import { css } from '@emotion/css';
import { memo } from 'react';

import { t } from '@grafana/i18n';
import { Switch } from '@grafana/ui';

type SparkJoyToggleProps = {
  value: boolean;
  onToggle: () => void;
  className?: string;
};

export const SparkJoyToggle = memo(function SparkJoyToggle({ value, onToggle, className }: SparkJoyToggleProps) {
  const container = css({ display: 'inline-flex', alignItems: 'center', gap: 8 });
  const italic = css({ fontStyle: 'italic', opacity: 0.85 });
  const leftLabel = value
    ? t('explore.explore-toolbar.go-back-old-view', 'Go back to old view')
    : t('explore.explore-toolbar.spark-some-joy', 'Spark Some Joy');
  return (
    <span className={container}>
      <span className={italic}>{leftLabel}</span>
      <Switch
        key="sparks-joy-toggle"
        value={value}
        name="Spark joy"
        onChange={onToggle}
        aria-label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
        label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
        className={className}
      />
    </span>
  );
});

export default SparkJoyToggle;
