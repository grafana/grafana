import { css, cx } from '@emotion/css';
import { SceneComponentProps } from '@grafana/scenes';
import { Tab } from '@grafana/ui';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Checkbox, clearButtonStyles, useElementSelection, useStyles2 } from '@grafana/ui';
// eslint-disable-next-line no-restricted-imports
import { getFocusStyles } from '@grafana/ui/src/themes/mixins';

import { getDashboardSceneFor } from '../../utils/utils';
import { useIsClone } from '../../utils/clone';
import {
  useDashboardState,
  useElementSelectionScene,
  useInterpolatedTitle,
  useIsConditionallyHidden,
} from '../../utils/utils';

import { TabItem } from './TabItem';
import { TabItemAffix } from './TabItemAffix';
import { TabItemSuffix } from './TabItemSuffix';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const { title, key } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect } = useElementSelectionScene(model);
  const title = useInterpolatedTitle(model);
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);

  if (isConditionallyHidden && !showHiddenElements) {
    return null;
  }

  const isCurrentTab = model.isCurrentTab();

  return (
    <div
      className={cx(
        styles.container,
        isSelected && 'dashboard-selected-element',
        isConditionallyHidden && showHiddenElements && 'dashboard-visible-hidden-element'
      )}
      role="presentation"
    >
      {isEditing && <TabItemAffix model={model} />}

      <span onPointerDown={onSelect}>
        <Checkbox value={!!isSelected} />
      </span>

      <button
        className={cx(clearStyles, styles.label, isCurrentTab ? styles.labelActive : styles.labelNotActive)}
        role="tab"
        aria-selected={isCurrentTab}
        onClick={() => model.onChangeTab()}
      >
        {title}
      </button>

      {isEditing && <TabItemSuffix model={model} />}
    </div>
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
