import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { ErrorBoundaryAlert, useTheme2 } from '@grafana/ui';

import {
  EXTENSION_SIDEBAR_EXTENSION_POINT_ID,
  getComponentMetaFromComponentId,
  useExtensionSidebarContext,
} from './ExtensionSidebarProvider';

export const DEFAULT_EXTENSION_SIDEBAR_WIDTH = 300;
export const MIN_EXTENSION_SIDEBAR_WIDTH = 100;
export const MAX_EXTENSION_SIDEBAR_WIDTH = Math.floor(window.innerWidth * (2 / 3));

type ExtensionSidebarComponentProps = {
  props?: Record<string, unknown>;
};

export function ExtensionSidebar() {
  const styles = getStyles(useTheme2());
  const { dockedComponentId, isEnabled, props = {} } = useExtensionSidebarContext();
  const { components, isLoading } = usePluginComponents<ExtensionSidebarComponentProps>({
    extensionPointId: EXTENSION_SIDEBAR_EXTENSION_POINT_ID,
  });

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
        <ErrorBoundaryAlert>
          <ExtensionComponent {...props} />
        </ErrorBoundaryAlert>
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
      width: '100%',
      height: '100%',
      overflow: 'auto',
    }),
    content: css({
      flex: 1,
      minHeight: 0,
    }),
  };
};
