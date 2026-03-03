import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeRegistryItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { ThemePreview } from '../../../core/components/Theme/ThemePreview';

interface ThemeCardProps {
  themeOption: ThemeRegistryItem;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function ThemeCard({ themeOption, onEdit, onRemove }: ThemeCardProps) {
  const theme = themeOption.build();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {themeOption.name}
        <Stack>
          {Boolean(onEdit) && (
            <IconButton
              name="pen"
              onClick={onEdit}
              aria-label={t('shared.preferences.theme.edit', 'Edit theme: {{name}}', { name: themeOption.name })}
            />
          )}
          {Boolean(onRemove) && (
            <IconButton
              name="trash-alt"
              onClick={onRemove}
              aria-label={t('shared.preferences.theme.delete', 'Delete theme: {{name}}', { name: themeOption.name })}
            />
          )}
        </Stack>
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
      height: '200px',
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
