import { css } from '@emotion/css';
import { css as cssReact, Global } from '@emotion/react';

import { GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { getComponentMetaFromComponentId, useExtensionSidebarContext } from './ExtensionSidebarProvider';

export const DEFAULT_EXTENSION_SIDEBAR_WIDTH = 300;
export const MIN_EXTENSION_SIDEBAR_WIDTH = 100;
export const MAX_EXTENSION_SIDEBAR_WIDTH = Math.floor(window.innerWidth * (2 / 3));

type ExtensionSidebarComponentProps = {
  props?: Record<string, unknown>;
};

export function ExtensionSidebar() {
  const styles = getStyles(useTheme2());
  const { dockedComponentId, props = {} } = useExtensionSidebarContext();
  const { components, isLoading } = usePluginComponents<ExtensionSidebarComponentProps>({
    extensionPointId: PluginExtensionPoints.ExtensionSidebar,
  });

  if (isLoading || !dockedComponentId) {
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
        {/* When the sidebar is open, we don't want the body to scroll */}
        {/* Need type assertion here due to the use of !important */}
        {/* see https://github.com/frenic/csstype/issues/114#issuecomment-697201978 */}
        {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
        <Global styles={[cssReact({ body: { overflowY: 'unset !important' as 'unset' } })]} />
        <ExtensionComponent {...props} />
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
      width: '100%',
      height: '100%',
      overflow: 'auto',
      // Temp fix for AI assistant, remove in a 1-2 months
      ' > div > div': {
        margin: 0,
      },
    }),
    content: css({
      flex: 1,
      minHeight: 0,
    }),
  };
};
