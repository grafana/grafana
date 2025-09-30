import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Switch, Icon, useStyles2 } from '@grafana/ui';

type SparkJoyToggleProps = {
  value: boolean;
  onToggle: () => void;
  className?: string;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({ color: theme.colors.text.primary, display: 'inline-flex', alignItems: 'center', gap: 8 }),
  };
};

export const SparkJoyToggle = memo(function SparkJoyToggle({ value, onToggle, className }: SparkJoyToggleProps) {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.container}>
      <Icon name="wizard-hat" size="lg" title={t('explore.explore-toolbar.go-back-old-view', 'Go back to old view')} />
      <Switch
        key="sparks-joy-toggle"
        value={value}
        name="Spark joy"
        onChange={onToggle}
        aria-label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
        label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
        className={className}
        shouldSparkJoy
      />
      <Icon name="kawaii-heart" size="lg" title={t('explore.explore-toolbar.spark-some-joy', 'Spark Some Joy')} />
    </span>
  );
});

export default SparkJoyToggle;
