import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FlexItem } from '@grafana/plugin-ui';
import { useSceneObjectState } from '@grafana/scenes';
import { Sidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardEditPane } from './DashboardEditPane';
import { DashboardOutline } from './DashboardOutline';
import { ElementEditPane } from './ElementEditPane';

export interface Props {
  editPane: DashboardEditPane;
  dashboard: DashboardScene;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, dashboard }: Props) {
  const { selection, openPane } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const { isEditing } = dashboard.useState();
  const editableElement = useMemo(() => (selection ? selection.createSelectionElement() : undefined), [selection]);
  const selectedObject = selection?.getFirstObject();
  const isNewElement = selection?.isNewElement() ?? false;

  // const [outlineCollapsed, setOutlineCollapsed] = useLocalStorage(
  //   'grafana.dashboard.edit-pane.outline.collapsed',
  //   true
  // );
  // const [outlinePaneSize = 0.4, setOutlinePaneSize] = useLocalStorage('grafana.dashboard.edit-pane.outline.size', 0.4);

  // splitter for template and payload editor
  // const splitter = useSplitter({
  //   direction: 'column',
  //   handleSize: 'sm',
  //   // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
  //   initialSize: 1 - outlinePaneSize,
  //   dragPosition: 'middle',
  //   onSizeChanged: (size) => {
  //     setOutlinePaneSize(1 - size);
  //   },
  // });

  // if (outlineCollapsed) {
  //   splitter.primaryProps.style.flexGrow = 1;
  //   splitter.primaryProps.style.minHeight = 'unset';
  //   splitter.secondaryProps.style.flexGrow = 0;
  //   splitter.secondaryProps.style.minHeight = 'min-content';
  // } else {
  //   splitter.primaryProps.style.minHeight = 'unset';
  //   splitter.secondaryProps.style.minHeight = 'unset';
  // }

  return (
    <>
      {editableElement && (
        <Sidebar.OpenPane>
          <ElementEditPane
            key={selectedObject?.state.key}
            editPane={editPane}
            element={editableElement}
            isNewElement={isNewElement}
          />
        </Sidebar.OpenPane>
      )}
      {openPane === 'outline' && (
        <Sidebar.OpenPane>
          <DashboardOutline editPane={editPane} isEditing={isEditing} />
        </Sidebar.OpenPane>
      )}
      <Sidebar.Toolbar>
        <Sidebar.Button icon="download-alt" title="Export" />
        {isEditing && (
          <>
            <Sidebar.Divider />
            <Sidebar.Button icon="corner-up-left" title={'Undo'} />
            <Sidebar.Button icon="corner-up-right" title={'Redo'} />
          </>
        )}
        <Sidebar.Divider />
        <Sidebar.Button
          icon="list-ui-alt"
          onClick={() => editPane.openPane('outline')}
          title={t('dashboard.sidebar.outline', 'Outline')}
          tooltip={t('dashboard.sidebar.outline-tooltip', 'Content outline')}
          active={openPane === 'outline'}
        ></Sidebar.Button>
        {isEditing && (
          <Sidebar.Button
            icon="cog"
            onClick={() => editPane.selectObject(dashboard, dashboard.state.key!)}
            title={t('dashboard.sidebar.dashboard-options', 'Options')}
            tooltip={t('dashboard.sidebar.dashboard-options-tooltip', 'Dashboard options')}
            active={selectedObject === dashboard ? true : false}
          />
        )}
        <FlexItem grow={1} />
      </Sidebar.Toolbar>
    </>
  );
}
