import { css } from '@emotion/css';
import { css as cssReact, Global } from '@emotion/react';

import { GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { getComponentMetaFromComponentId, useBottomDrawerContext } from './BottomDrawerProvider';

export const DEFAULT_BOTTOM_DRAWER_HEIGHT = 200;
export const MIN_BOTTOM_DRAWER_HEIGHT = 100;
export const MAX_BOTTOM_DRAWER_HEIGHT = Math.floor(window.innerHeight * 0.5);

type BottomDrawerComponentProps = {
  props?: Record<string, unknown>;
};

export function BottomDrawer() {
  const styles = getStyles(useTheme2());
  const { dockedComponentId, props = {} } = useBottomDrawerContext();
  const { components, isLoading } = usePluginComponents<BottomDrawerComponentProps>({
    extensionPointId: PluginExtensionPoints.BottomDrawer,
  });

  if (!dockedComponentId || isLoading) {
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
    <div className={styles.drawerWrapper}>
      <div className={styles.content}>
        {/* When the drawer is open, we don't want the body to scroll */}
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
    drawerWrapper: css({
      backgroundColor: theme.colors.background.primary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
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
