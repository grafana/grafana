import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface DescriptionTooltipProps {
  description?: string;
}

export function DescriptionTooltip({ description }: DescriptionTooltipProps) {
  const styles = useStyles2(getStyles);

  if (!description) {
    return null;
  }

  return (
    <Tooltip content={description} placement="top" interactive>
      <span className={styles.icon}>
        <Icon name="info-circle" size="sm" aria-label={t('search.description-tooltip.label', 'Description')} />
      </span>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    flex: '0 0 auto',
  }),
});
