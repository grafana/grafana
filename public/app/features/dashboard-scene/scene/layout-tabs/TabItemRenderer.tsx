import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { locationUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Checkbox, clearButtonStyles, useElementSelection, useStyles2 } from '@grafana/ui';
// eslint-disable-next-line no-restricted-imports
import { getFocusStyles } from '@grafana/ui/src/themes/mixins';

import { getDashboardSceneFor } from '../../utils/utils';

import { TabItem } from './TabItem';
import { TabItemAffix } from './TabItemAffix';
import { TabItemSuffix } from './TabItemSuffix';

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

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      listStyle: 'none',
      position: 'relative',
      display: 'flex',
      whiteSpace: 'nowrap',
      padding: theme.spacing(0.5),
      alignItems: 'center',
    }),
    label: css({
      color: theme.colors.text.secondary,
      padding: theme.spacing(1, 1.5, 0.5),
      borderRadius: theme.shape.radius.default,
      userSelect: 'none',

      display: 'block',
      height: '100%',

      svg: {
        marginRight: theme.spacing(1),
      },

      '&:focus-visible': getFocusStyles(theme),

      '&::before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        left: 0,
        right: 0,
        height: '4px',
        borderRadius: theme.shape.radius.default,
        bottom: 0,
      },
    }),
    labelNotActive: css({
      'a:hover, &:hover, &:focus': {
        color: theme.colors.text.primary,

        '&::before': {
          backgroundColor: theme.colors.action.hover,
        },
      },
    }),
    labelActive: css({
      color: theme.colors.text.primary,
      overflow: 'hidden',

      '&::before': {
        backgroundImage: theme.colors.gradients.brandHorizontal,
      },
    }),
    affix: css({
      marginRight: theme.spacing(1),
    }),
    suffix: css({
      marginLeft: theme.spacing(1),
    }),
  };
}
