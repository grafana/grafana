import { cx } from '@emotion/css';
import { useLocation } from 'react-router';

import { locationUtil, textUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Tab, useElementSelection } from '@grafana/ui';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const { title, key, isDropTarget } = model.useState();
  const parentLayout = model.getParentLayout();
  const { tabs, currentTabIndex } = parentLayout.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect, isSelectable } = useElementSelection(key);
  const mySlug = model.getSlug();
  const urlKey = parentLayout.getUrlKey();
  const myIndex = tabs.findIndex((tab) => tab === model);
  const isActive = myIndex === currentTabIndex;
  const location = useLocation();
  const href = textUtil.sanitize(locationUtil.getUrlForPartial(location, { [urlKey]: mySlug }));

  return (
    <Tab
      truncate
      className={cx(
        isSelected && 'dashboard-selected-element',
        isSelectable && !isSelected && 'dashboard-selectable-element',
        isDropTarget && 'dashboard-drop-target'
      )}
      active={isActive}
      role="presentation"
      title={titleInterpolated}
      href={href}
      aria-selected={isActive}
      onPointerDown={onSelect}
      label={titleInterpolated}
      data-dashboard-drop-target-key={model.state.key}
    />
  );
}
