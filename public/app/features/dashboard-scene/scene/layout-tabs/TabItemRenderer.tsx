import { css, cx } from '@emotion/css';
import { useLocation } from 'react-router';

import { GrafanaTheme2, locationUtil, textUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Tab, useElementSelection, useStyles2 } from '@grafana/ui';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const styles = useStyles2(getStyles);
  const { title, key } = model.useState();
  const parentLayout = model.getParentLayout();
  const { tabs, currentTabIndex } = parentLayout.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect, isSelectable } = useElementSelection(key);
  const myIndex = tabs.findIndex((tab) => tab === model);
  const isActive = myIndex === currentTabIndex;
  const location = useLocation();
  const href = textUtil.sanitize(locationUtil.getUrlForPartial(location, { tab: myIndex }));

  return (
    <Tab
      className={cx(
        styles.container,
        isSelected && 'dashboard-selected-element',
        isSelectable && !isSelected && 'dashboard-selectable-element'
      )}
      active={isActive}
      role="presentation"
      title={titleInterpolated}
      href={href}
      aria-selected={isActive}
      onPointerDown={onSelect}
      label={titleInterpolated}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    maxWidth: theme.spacing(40),

    '& > :is(a,button)': css({
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      wordBreak: 'break-word',
      overflow: 'hidden',
    }),
  }),
});
