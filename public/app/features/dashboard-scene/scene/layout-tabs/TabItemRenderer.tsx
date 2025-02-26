import { css, cx } from '@emotion/css';
import { useLocation } from 'react-router';

import { GrafanaTheme2, locationUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Tab, useElementSelection } from '@grafana/ui';
// eslint-disable-next-line no-restricted-imports

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const { title, key } = model.useState();
  const parentLayout = model.getParentLayout();
  const { tabs, currentTabIndex } = parentLayout.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect } = useElementSelection(key);
  const myIndex = tabs.findIndex((tab) => tab === model);
  const isActive = myIndex === currentTabIndex;
  const location = useLocation();
  const href = locationUtil.getUrlForPartial(location, { tab: myIndex });
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);

  return (
    <>
      <div className={cx(styles.container, isSelected && 'dashboard-selected-element')} role="presentation">
        <span onPointerDown={onSelect}>
          <Checkbox value={!!isSelected} />
        </span>

        <a
          href={href}
          className={cx(clearStyles, styles.label, isActive ? styles.labelActive : styles.labelNotActive)}
          role="tab"
          aria-selected={isActive}
        >
          {titleInterpolated}
        </a>
      </div>

      {/* <Tab
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
      /> */}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      listStyle: 'none',
      position: 'relative',
      display: 'flex',
      whiteSpace: 'nowrap',
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
