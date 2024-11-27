import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Field, Select, Button } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardLayoutManager, isLayoutParent, LayoutRegistryItem } from '../types';

import { layoutRegistry } from './layoutRegistry';

interface Props {
  layoutManager: DashboardLayoutManager;
  children: React.ReactNode;
}

export function LayoutEditChrome({ layoutManager, children }: Props) {
  const styles = useStyles2(getStyles);
  const { isEditing } = getDashboardSceneFor(layoutManager).useState();
  const [isPinned, setPinned] = useState(false);

  const layouts = layoutRegistry.list();
  const options = layouts.map((layout) => ({
    label: layout.name,
    value: layout,
  }));

  const currentLayoutId = layoutManager.getDescriptor().id;
  const currentLayoutOption = options.find((option) => option.value.id === currentLayoutId);

  return (
    <div className={styles.wrapper}>
      {isEditing && (
        <div
          className={styles.editHeader}
          style={{
            position: isPinned ? 'sticky' : undefined,
          }}
        >
          <Field label="Layout type">
            <Select
              options={options}
              value={currentLayoutOption}
              onChange={(option) => changeLayoutTo(layoutManager, option.value!)}
            />
          </Field>
          {layoutManager.renderEditor?.()}
          <Button
            icon="gf-pin"
            variant={isPinned ? 'primary' : 'secondary'}
            className={styles.pinButton}
            onClick={(e) => {
              e.preventDefault();
              setPinned(!isPinned);
            }}
          ></Button>
        </div>
      )}
      {children}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    editHeader: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 0.5, 1),
      margin: theme.spacing(0, 0, 1, 0),
      alignItems: 'flex-end',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(1),
      background: theme.colors.background.canvas,
      top: 0,
      zIndex: theme.zIndex.portal,

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },

      '& > div': {
        marginBottom: 0,
        marginRight: theme.spacing(1),
      },
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      width: '100%',
    }),
    icon: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      gap: theme.spacing(1),
    }),
    rowTitle: css({}),
    rowActions: css({
      display: 'flex',
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 200ms ease-in',
      },

      '&:hover, &:focus-within': {
        opacity: 1,
      },
    }),
    pinButton: css({
      marginLeft: 'auto',
    }),
  };
}

function changeLayoutTo(currentLayout: DashboardLayoutManager, newLayoutDescriptor: LayoutRegistryItem) {
  const layoutParent = currentLayout.parent;
  if (layoutParent && isLayoutParent(layoutParent)) {
    layoutParent.switchLayout(newLayoutDescriptor.createFromLayout(currentLayout));
  }
}
