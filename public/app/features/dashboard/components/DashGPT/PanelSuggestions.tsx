import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { PanelChrome, useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { DashboardModel, PanelModel } from '../../state';
import { EmbeddedScene } from '@grafana/scenes';
import { DashboardScene } from 'app/features/scenes/dashboard/DashboardScene';
import { SceneGridLayout } from '@grafana/scenes';
import { createSceneObjectsForPanels, createPanelDataProvider } from 'app/features/scenes/dashboard/DashboardsLoader';
import { SceneTimeRange } from '@grafana/scenes';
import { SceneVariableSet } from '@grafana/scenes';
import { SceneRefreshPicker } from '@grafana/scenes';
import { SceneTimePicker } from '@grafana/scenes';
import { VariableValueSelectors } from '@grafana/scenes';
import { SceneObject } from '@grafana/scenes';
import { Panel } from '@grafana/schema';
import { SceneFlexLayout } from '@grafana/scenes';
import { SceneFlexItem } from '@grafana/scenes';
import { VizPanel } from '@grafana/scenes';
import { getVizPanelKeyForPanelId } from 'app/features/scenes/dashboard/utils';
import { SceneObjectBase } from '@grafana/scenes';
import { SceneObjectState } from '@grafana/scenes';

interface PanelSuggestionsProps {
  suggestions: PanelModel[];
  onDismiss: () => void;
}

export const PanelSuggestions = ({ suggestions, onDismiss }: PanelSuggestionsProps) => {
  const styles = useStyles2(getStyles);

  const dashboard = getDashboardSrv().getCurrent();

  const onUseSuggestion = (panel: PanelModel) => {
    dashboard?.addPanel(panel);
    onDismiss();
  };

  const previewScene = getSceneModel({panels: suggestions, dashboard, onClickPanel: onUseSuggestion})

  return (
    <div className={styles.wrapper}>
      <previewScene.Component model={previewScene} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(2)};
    gap: ${theme.spacing(3)};
    margin-bottom: ${theme.spacing(3)};
  `,
  suggestion: css`
    cursor: pointer;
  `,
  suggestionContent: css`
    padding: ${theme.spacing(2)};
  `,
});

function getSceneModel({panels, onClickPanel}: {panels: PanelModel[], onClickPanel: (panel: PanelModel) => void}) {

  const controls: SceneObject[] = [
    new VariableValueSelectors({}),
    new SceneTimePicker({}),
    new SceneRefreshPicker({}),
  ];


  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'column',

      children: panels.map((panel) => createVizPanelFromPanelModel(panel, onClickPanel)),
      // children: [],
    }),
    // $timeRange: new SceneTimeRange(),
    // $variables: new SceneVariableSet({
    //   variables: createSceneVariableFromVariableModel(dashboard!.getVariables()),
    // }),
    // controls: controls,
  });
}

function normalizePanel(panel: PanelModel): PanelModel {

  return new PanelModel({
    ...panel,
    gridPos: {
    },
  });
}

export function createVizPanelFromPanelModel(panel: PanelModel, onClick: (panel: PanelModel) => void) {
  return  new SceneFlexItem({
      minHeight: 200,
      body: new SceneClickableElement({
        onClick: () => onClick(panel),
        children: new VizPanel({
          key: getVizPanelKeyForPanelId(panel.id),
          title: panel.title,
          pluginId: panel.type,
          options: panel.options ?? {},
          fieldConfig: panel.fieldConfig,
          pluginVersion: panel.pluginVersion,
          displayMode: panel.transparent ? 'transparent' : undefined,
          // To be replaced with it's own option persited option instead derived
          hoverHeader: !panel.title && !panel.timeFrom && !panel.timeShift,
          $data: createPanelDataProvider(panel),
        }),
      })
    });
}

interface ClickableElementState extends SceneObjectState {
  onClick: () => void;
  children: SceneObject;
}

export class SceneClickableElement extends SceneObjectBase<ClickableElementState> {
  static Component = ClickableElementRenderer;
}

function ClickableElementRenderer({ model }: { model: SceneClickableElement }) {
  debugger
  const {onClick, children} = model.useState();
  return (
    <div onClick={onClick}>
      <children.Component model={children} />
    </div>
  );
}