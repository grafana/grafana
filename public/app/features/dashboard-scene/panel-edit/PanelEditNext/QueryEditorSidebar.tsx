import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { useQueryRunnerContext } from './QueryEditorContext';

export enum SidebarSize {
  Mini = 'mini',
  Full = 'full',
}
interface QueryEditorSidebarProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
}

export function QueryEditorSidebar({ sidebarSize, setSidebarSize }: QueryEditorSidebarProps) {
  const styles = useStyles2(getStyles);
  const isMini = sidebarSize === SidebarSize.Mini;

  const { queries } = useQueryRunnerContext();

  console.log({ queries });

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

  return (
    <div className={styles.container}>
      <Button
        icon={isMini ? 'expand-alt' : 'compress-alt'}
        size="sm"
        variant="secondary"
        onClick={toggleSize}
        aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        className={styles.iconButton}
      />
      <div className={styles.body}>
        <Text color="secondary">{t('query-editor-next.sidebar.placeholder', 'Sidebar content placeholder')}</Text>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      position: 'relative',
    }),
    iconButton: css({
      padding: theme.spacing(0.5),
      minWidth: theme.spacing(4),
      justifyContent: 'center',
      position: 'absolute',
      top: theme.spacing(1),
      left: theme.spacing(1),
      zIndex: 1,
    }),
    body: css({
      flexGrow: 1,
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      padding: theme.spacing(2),
    }),
  };
}
