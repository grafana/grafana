import React from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { ShareEmbed } from 'app/features/dashboard/components/ShareModal/ShareEmbed';

import { DashboardScene } from '../scene/DashboardScene';
import { getPanelIdForVizPanel } from '../utils/utils';

import { SceneShareTabState } from './types';

export interface SharePanelEmbedTabState extends SceneShareTabState {
  panelRef: SceneObjectRef<VizPanel>;
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class SharePanelEmbedTab extends SceneObjectBase<SharePanelEmbedTabState> {
  static Component = SharePanelEmbedTabRenderer;

  public constructor(state: SharePanelEmbedTabState) {
    super(state);
  }

  public getTabLabel() {
    return t('share-modal.tab-title.panel-embed', 'Embed');
  }
}

function SharePanelEmbedTabRenderer({ model }: SceneComponentProps<SharePanelEmbedTab>) {
  const { panelRef, dashboardRef } = model.useState();
  const p = panelRef.resolve();

  const dash = dashboardRef.resolve();
  const { uid: dashUid } = dash.useState();
  const id = getPanelIdForVizPanel(p);
  const timeRangeState = sceneGraph.getTimeRange(p);

  return (
    <ShareEmbed
      panel={{
        id,
        timeFrom:
          typeof timeRangeState.state.value.raw.from === 'string' ? timeRangeState.state.value.raw.from : undefined,
      }}
      range={timeRangeState.state.value}
      dashboard={{ uid: dashUid ?? '', time: timeRangeState.state.value }}
    />
  );
}
