import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { useExtensionSidebarContext } from './ExtensionSidebarProvider';

export const EXTENSION_SIDEBAR_WIDTH = '300px';

export function ExtensionSidebar() {
  const styles = getStyles(useTheme2());
  const { components, dockedPluginId } = useExtensionSidebarContext();

  if (components.size === 0 || !dockedPluginId) {
    return null;
  }

  const ExtensionComponent = components.get(dockedPluginId);
  if (!ExtensionComponent) {
    return null;
  }

  return (
    <div className={styles.sidebarWrapper}>
      <ExtensionComponent />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    sidebarWrapper: css({
      backgroundColor: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      width: EXTENSION_SIDEBAR_WIDTH,
      height: '100%',
    }),
  };
};
