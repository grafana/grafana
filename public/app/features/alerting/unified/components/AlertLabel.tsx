import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

interface Props {
  labelKey: string;
  value: string;
  operator?: string;
  onRemoveLabel?: () => void;
}

export const AlertLabel = ({ labelKey, value, operator = '=', onRemoveLabel }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {labelKey}
      {operator}
      {value}
      {!!onRemoveLabel && (
        <IconButton
          name="times"
          size="xs"
          onClick={onRemoveLabel}
          tooltip={t('alerting.alert-label.tooltip-remove-label', 'Remove label')}
        />
      )}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    border: `solid 1px ${theme.colors.border.medium}`,
    fontSize: theme.typography.bodySmall.fontSize,
    backgroundColor: theme.colors.background.secondary,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
    display: 'inline-block',
    lineHeight: '1.2',
  }),
});
