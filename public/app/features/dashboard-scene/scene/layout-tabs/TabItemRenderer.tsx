import { useMemo } from 'react';

import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Tab, useElementSelection } from '@grafana/ui';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { isClonedKey } from '../../utils/clone';
import { getDashboardSceneFor } from '../../utils/utils';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const { title, key, $behaviors } = model.useState();
  const isClone = useMemo(() => isClonedKey(key!), [key]);
  const parentLayout = model.getParentLayout();
  const { currentTab } = parentLayout.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing, showHiddenElements } = dashboard.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect } = useElementSelection(key);

  const conditionalRendering = $behaviors?.find((behavior) => behavior instanceof ConditionalRendering);
  if (!(conditionalRendering?.evaluate() ?? true) && !showHiddenElements) {
    return null;
  }

  return (
    <Tab
      className={!isClone && isSelected ? 'dashboard-selected-element' : undefined}
      label={titleInterpolated}
      active={model === currentTab}
      onPointerDown={(evt) => {
        evt.stopPropagation();

        if (isEditing) {
          if (isClone) {
            dashboard.state.editPane.clearSelection();
          } else {
            onSelect?.(evt);
          }
        }

        parentLayout.changeTab(model);
      }}
    />
  );
}
