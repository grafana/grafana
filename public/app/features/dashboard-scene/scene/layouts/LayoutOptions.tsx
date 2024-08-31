import { css, cx } from '@emotion/css';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Text, Button, Field, Select, Stack } from '@grafana/ui';

import { DashboardScene } from '../DashboardScene';
import { ViewPanelScene } from '../ViewPanelScene';

import { AutomaticGridLayoutManager } from './AutomaticGridLayoutManager';
import { CanvasLayoutManager } from './CanvasLayout/CanvasLayoutManager';
import { ManualGridLayoutManager } from './ManualGridLayoutWrapper';
import { DashboardLayoutManager, LayoutDescriptor } from './types';

interface Props {
  layout: DashboardLayoutManager;
  scene: DashboardScene;
}

export function LayoutOptions({ layout, scene }: Props) {
  const styles = useStyles2(getStyles);
  const [showOptions, toggleShowOptions] = useToggle(false);

  if (layout instanceof ViewPanelScene) {
    return null;
  }

  if (!showOptions) {
    return (
      <div className={styles.row}>
        <Text>Layout</Text>
        <Text variant="bodySmall" color="secondary">
          (Type: {layout.getDescriptor().name})
        </Text>

        <div className={styles.rowActions}>
          <Button
            icon="cog"
            variant="secondary"
            size="sm"
            fill="text"
            onClick={toggleShowOptions}
            tooltip={'Show options'}
          />
        </div>
      </div>
    );
  }

  const layouts = getLayouts();
  const options = layouts.map((layout) => ({
    label: layout.name,
    value: layout,
  }));

  const currentLayoutOption = options.find((option) => option.value.id === layout.getLayoutId());

  return (
    <div className={cx(styles.row, styles.rowOptions)}>
      <Field label="Layout type">
        <Select
          options={options}
          value={currentLayoutOption}
          onChange={(option) => changeLayoutTo(scene, layout, option.value!)}
        />
      </Field>
      {layout.renderEditor?.()}

      <Button icon="check" variant="secondary" onClick={toggleShowOptions} tooltip={'Hide options'} />
    </div>
  );
}

function getLayouts(): LayoutDescriptor[] {
  return [
    ManualGridLayoutManager.getDescriptor(),
    AutomaticGridLayoutManager.getDescriptor(),
    CanvasLayoutManager.getDescriptor(),
  ];
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 0.5, 1),
      margin: theme.spacing(1, 0),
      alignItems: 'flex-end',

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    rowOptions: css({
      paddingBottom: theme.spacing(1),
      '& > div': {
        marginBottom: 0,
        marginRight: theme.spacing(1),
      },
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
  };
}

function changeLayoutTo(
  dashboard: DashboardScene,
  currentLayout: DashboardLayoutManager,
  newLayout: LayoutDescriptor
): any {
  const newLayoutManager = newLayout.switchTo(currentLayout);
  dashboard.setState({ body: newLayoutManager });
}
