import { cx } from '@emotion/css';
import { useLocation } from 'react-router';

import { locationUtil, textUtil } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Tab } from '@grafana/ui';

import {
  useDashboardState,
  useIsConditionallyHidden,
  useElementSelectionScene,
  useInterpolatedTitle,
} from '../../utils/utils';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const parentLayout = model.getParentLayout();
  const { tabs, currentTabIndex } = parentLayout.useState();
  const myIndex = tabs.findIndex((tab) => tab === model);
  const isActive = myIndex === currentTabIndex;
  const location = useLocation();
  const href = textUtil.sanitize(locationUtil.getUrlForPartial(location, { tab: myIndex }));
  const { showHiddenElements } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);
  const { isSelected, onSelect, isSelectable } = useElementSelectionScene(model);
  const titleInterpolated = useInterpolatedTitle(model);

  if (isConditionallyHidden && !showHiddenElements) {
    return null;
  }

  return (
    <Tab
      className={cx(
        isSelected && 'dashboard-selected-element',
        isSelectable && !isSelected && 'dashboard-selectable-element'
      )}
      active={isActive}
      role="presentation"
      href={href}
      aria-selected={isActive}
      onPointerDown={onSelect}
      label={titleInterpolated}
    />
  );
}
