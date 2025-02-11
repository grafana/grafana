import { SceneComponentProps } from '@grafana/scenes';
import { Tab } from '@grafana/ui';

import { useIsClone } from '../../utils/clone';
import {
  useDashboardState,
  useElementSelectionScene,
  useInterpolatedTitle,
  useIsConditionallyHidden,
} from '../../utils/utils';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const isClone = useIsClone(model);
  const parentLayout = model.getParentLayout();
  const { currentTab } = parentLayout.useState();
  const { isEditing, showHiddenElements } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);
  const { isSelected, onSelect, onClear } = useElementSelectionScene(model);
  const title = useInterpolatedTitle(model);

  if (isConditionallyHidden && !showHiddenElements) {
    return null;
  }

  return (
    <Tab
      className={!isClone && isSelected ? 'dashboard-selected-element' : undefined}
      label={title}
      active={model === currentTab}
      onPointerDown={(evt) => {
        evt.stopPropagation();

        if (isEditing) {
          if (isClone) {
            onClear?.();
          } else {
            onSelect?.(evt);
          }
        }

        parentLayout.changeTab(model);
      }}
    />
  );
}
