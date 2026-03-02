import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeRegistryItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

import { ThemePreview } from '../../../core/components/Theme/ThemePreview';

interface ThemeCardProps {
  themeOption: ThemeRegistryItem;
  onRemove?: () => void;
}

export function ThemeCard({ themeOption, onRemove }: ThemeCardProps) {
  const theme = themeOption.build();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {themeOption.name}
        {Boolean(onRemove) && (
          <IconButton
            name="trash-alt"
            onClick={onRemove}
            aria-label={t('shared.preferences.theme.delete', 'Delete theme: {{name}}', { name: themeOption.name })}
          />
        )}
      </div>
      <ThemePreview theme={theme} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }),
    header: css({
      alignItems: 'center',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(1),
    }),
  };
};
