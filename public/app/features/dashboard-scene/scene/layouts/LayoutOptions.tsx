import { css } from '@emotion/css';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneGridLayout, SceneObject } from '@grafana/scenes';
import { useStyles2, Text, Icon, Button, Modal, Field, Input, Select } from '@grafana/ui';

import { DashboardScene } from '../DashboardScene';
import { ViewPanelScene } from '../ViewPanelScene';
import { RowOptionsForm } from '../row-actions/RowOptionsForm';

interface Props {
  layout: SceneObject;
  scene: DashboardScene;
}

export function LayoutOptions({ layout, scene }: Props) {
  const styles = useStyles2(getStyles);
  const [showOptions, toggleShowOptions] = useToggle(false);

  if (layout instanceof ViewPanelScene) {
    return null;
  }

  return (
    <div className={styles.row}>
      <Text>Layout</Text>
      <Text variant="bodySmall" color="secondary">
        (Type: Manual positioning grid)
      </Text>

      <div className={styles.rowActions}>
        <Button icon="cog" variant="secondary" fill="text" onClick={toggleShowOptions} />
      </div>
      {showOptions && (
        <Modal isOpen={true} title="Layout options" onDismiss={toggleShowOptions}>
          <LayoutOptionsForm layout={layout} scene={scene} />
        </Modal>
      )}
    </div>
  );
}

interface LayoutOptionsFormProps {
  layout: SceneObject;
  scene: DashboardScene;
}

function LayoutOptionsForm({ layout, scene }: LayoutOptionsFormProps) {
  const layouts = getLayouts();
  const options = layouts.map((layout) => ({
    label: layout.name,
    value: layout,
  }));

  const layoutId = getCurrentLayoutId(layout);
  const currentLayoutOption = options.find((option) => option.value.id === layoutId);

  return (
    <Field label="type">
      <Select
        options={options}
        value={currentLayoutOption}
        onChange={(option) => changeLayoutTo(scene, option.value!)}
      />
    </Field>
  );
}

interface LayoutDescriptor {
  name: string;
  id: string;
  editor: React.ComponentType<LayoutEditorProps<any>>;
}

function getLayouts(): LayoutDescriptor[] {
  return [
    {
      name: 'Manual positioning grid',
      id: 'scene-grid-layout',
      editor: ManualGridLayoutEditor,
    },
    {
      name: 'Automatic grid',
      id: 'automatic-grid',
      editor: AutomaticGridEditor,
    },
  ];
}

function getCurrentLayoutId(layout: SceneObject): string {
  if (layout instanceof SceneGridLayout) {
    return 'scene-grid-layout';
  }

  return 'automatic-grid';
}

interface LayoutEditorProps<T extends SceneObject = SceneObject> {
  layout: T;
}

function ManualGridLayoutEditor(props: LayoutEditorProps<SceneGridLayout>) {
  return <div>No options</div>;
}

interface LayoutEditorProps<T> {
  layout: T;
}

function AutomaticGridEditor(props: LayoutEditorProps<SceneGridLayout>) {
  return (
    <>
      <Field label="Grid template">
        <Input type="text" />
      </Field>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1),
      margin: theme.spacing(1, 1),
      alignItems: 'center',

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },
      borderBottom: `1px solid ${theme.colors.border.weak}`,
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

function changeLayoutTo(scene: DashboardScene, value: LayoutDescriptor): any {}
