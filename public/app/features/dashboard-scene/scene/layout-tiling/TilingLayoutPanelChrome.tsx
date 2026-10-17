import { type SceneObject, type VizPanelChromeProps, VizPanelDefaultChrome } from '@grafana/scenes';

/**
 * Chrome for panels in the TilingLayoutManager. The title and menu are rendered by the TilingLayout itself
 * (in the tab and the menu of the panel), so unlike PanelChrome there is no frame around the panel content.
 */
export function TilingLayoutPanelChrome(props: VizPanelChromeProps) {
  // Panels are cloned when the layout is changed, and then keep their chrome state.
  if (!isInTilingLayout(props.panel)) {
    return <VizPanelDefaultChrome {...props} />;
  }

  const { width, height, children } = props;

  // Not measured yet
  if (width === undefined || height === undefined) {
    return null;
  }

  return <>{children(width, height)}</>;
}

function isInTilingLayout(panel: SceneObject): boolean {
  let current: SceneObject | undefined = panel.parent;

  while (current) {
    if ('isTilingLayoutManager' in current) {
      return true;
    }
    current = current.parent;
  }

  return false;
}
