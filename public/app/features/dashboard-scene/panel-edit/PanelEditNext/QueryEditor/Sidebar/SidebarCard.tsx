import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { QueryEditorTypeConfig } from '../../constants';

interface SidebarCardProps {
  config: QueryEditorTypeConfig;
  isSelected: boolean;
  id: string;
  children: React.ReactNode;
  onClick: () => void;
}

export const SidebarCard = ({ config, isSelected, id, children, onClick }: SidebarCardProps) => {
  const styles = useStyles2(getStyles, { config, isSelected });
  const typeText = config.getLabel();

  return (
    <button
      className={styles.card}
      onClick={onClick}
      type="button"
      aria-label={t('query-editor-next.sidebar.card-click', 'Select card {{id}}', { id })}
      aria-pressed={isSelected}
    >
      <div className={styles.cardHeader}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name={config.icon} />
          <Text weight="light" variant="body">
            {typeText}
          </Text>
        </Stack>
      </div>
      <div className={styles.cardContent}>{children}</div>
    </button>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  { config, isSelected }: { config: QueryEditorTypeConfig; isSelected?: boolean }
) {
  return {
    card: css({
      display: 'flex',
      flexDirection: 'column',
      background: isSelected ? theme.colors.action.selected : theme.colors.background.secondary,
      border: `1px solid ${isSelected ? theme.colors.primary.border : theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      padding: 0,
      boxShadow: isSelected ? `0 0 9px 0 rgba(58, 139, 255, 0.3)` : 'none',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: isSelected
          ? theme.colors.action.selected
          : theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        borderColor: isSelected ? theme.colors.primary.border : theme.colors.border.medium,
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
    cardHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
      color: config.color,
      borderTopRightRadius: theme.shape.radius.default,
      borderTopLeftRadius: theme.shape.radius.default,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
  };
}
