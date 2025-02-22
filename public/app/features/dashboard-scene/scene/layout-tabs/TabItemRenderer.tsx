import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { locationUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Tab, useElementSelection } from '@grafana/ui';

import { isClonedKey } from '../../utils/clone';
import { getDashboardSceneFor } from '../../utils/utils';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const { title, key } = model.useState();
  const isClone = useMemo(() => isClonedKey(key!), [key]);
  const parentLayout = model.getParentLayout();
  const { tabs, currentTabIndex } = parentLayout.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect } = useElementSelection(key);
  const myIndex = tabs.findIndex((tab) => tab === model);
  const isActive = myIndex === currentTabIndex;
  const location = useLocation();
  const href = locationUtil.getUrlForPartial(location, { tab: myIndex });

  return (
    <Tab
      className={!isClone && isSelected ? 'dashboard-selected-element' : undefined}
      label={titleInterpolated}
      active={isActive}
      href={href}
      onPointerDown={(evt) => {
        if (isEditing && isActive && !isClone) {
          evt.stopPropagation();
          onSelect?.(evt);
        }
      }}
    />
  );
}
