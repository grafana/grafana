import { cx, css } from '@emotion/css';
import { memo, useId } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Switch, Icon, Tooltip, useStyles2 } from '@grafana/ui';

type SparkJoyToggleProps = {
  value: boolean;
  onToggle: () => void;
  className?: string;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    iconColor: css({
      color: theme.colors.text.secondary,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),

    label: css({
      cursor: 'pointer',
    }),

    container: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    }),
  };
};

export const SparkJoyToggle = memo(function SparkJoyToggle({ value, onToggle, className }: SparkJoyToggleProps) {
  const styles = useStyles2(getStyles);
  const id = useId();
  const wizardLabel = t('explore.explore-toolbar.go-back-old-view', 'Go back to old view');
  const joyfulLabel = t('explore.explore-toolbar.spark-some-joy', 'Spark Some Joy');

  return (
    <span className={styles.container}>
      {value && (
        <label htmlFor={id} className={cx(styles.label, styles.iconColor)}>
          <Tooltip content={wizardLabel} placement="left">
            <Icon name="wizard-hat" size="lg" title={wizardLabel} />
          </Tooltip>
        </label>
      )}
      {!value && (
        <div className={styles.iconColor}>
          <Icon name="wizard-hat" size="lg" title={wizardLabel} />
        </div>
      )}
      <Switch
        id={id}
        key="sparks-joy-toggle"
        value={value}
        name="Spark joy"
        onChange={onToggle}
        aria-label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
        label={t('explore.explore-toolbar.sparks-joy', 'Sparks Joy')}
        className={className}
        shouldSparkJoy
      />
      {!value && (
        <label htmlFor={id} className={cx(styles.label, styles.iconColor)}>
          <Tooltip content={joyfulLabel} placement="right">
            <Icon name="kawaii-heart" size="lg" title={joyfulLabel} />
          </Tooltip>
        </label>
      )}
      {value && (
        <div className={styles.iconColor}>
          <Icon name="kawaii-heart" size="lg" title={joyfulLabel} />
        </div>
      )}
    </span>
  );
});

export default SparkJoyToggle;
