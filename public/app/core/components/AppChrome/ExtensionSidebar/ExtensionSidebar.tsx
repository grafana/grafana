import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import {
  EXTENSION_SIDEBAR_EXTENSION_POINT_ID,
  getComponentMetaFromComponentId,
  useExtensionSidebarContext,
} from './ExtensionSidebarProvider';

export const EXTENSION_SIDEBAR_WIDTH = '300px';

export function ExtensionSidebar() {
  const styles = getStyles(useTheme2());
  const { dockedComponentId, isEnabled } = useExtensionSidebarContext();
  const { components, isLoading } = usePluginComponents({ extensionPointId: EXTENSION_SIDEBAR_EXTENSION_POINT_ID });

  if (isLoading || !dockedComponentId || !isEnabled) {
    return null;
  }

  const dockedMeta = getComponentMetaFromComponentId(dockedComponentId);
  if (!dockedMeta) {
    return null;
  }

  const ExtensionComponent = components.find(
    (c) => c.meta.pluginId === dockedMeta.pluginId && c.meta.title === dockedMeta.componentTitle
  );

  if (!ExtensionComponent) {
    return null;
  }

  return (
    <div className={styles.sidebarWrapper}>
      <div className={styles.content}>
        <ExtensionComponent />
      </div>
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
    content: css({
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
    }),
  };
};
