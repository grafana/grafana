import { type TimeRange } from '@grafana/data';
import { type SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ShareEmbed } from 'app/features/dashboard/components/ShareModal/ShareEmbed';
import { buildParams } from 'app/features/dashboard/components/ShareModal/utils';

import { type DashboardScene } from '../scene/DashboardScene';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { getDashboardUrl } from '../utils/getDashboardUrl';
import { getDashboardSceneFor } from '../utils/utils';

import { type SharePanelEmbedTab } from './SharePanelEmbedTab';

export function SharePanelEmbedTabRenderer({ model }: SceneComponentProps<SharePanelEmbedTab>) {
  const { panelRef } = model.useState();
  const p = panelRef.resolve();

  const dash = getDashboardSceneFor(model);
  const { uid: dashUid } = dash.useState();
  const timeRangeState = sceneGraph.getTimeRange(p);

  const timeFrom = timeRangeState instanceof PanelTimeRange ? timeRangeState.state.timeFrom : undefined;

  return (
    <ShareEmbed
      panelId={p.getPathId()}
      timeFrom={timeFrom}
      range={timeRangeState.state.value}
      dashboard={{ uid: dashUid ?? '', time: timeRangeState.state.value }}
      buildIframe={getIframeBuilder(dash)}
      onCancelClick={() => dash.closeModal()}
    />
  );
}

const getIframeBuilder =
  (dashboard: DashboardScene) =>
  (
    useCurrentTimeRange: boolean,
    _dashboardUid: string,
    selectedTheme?: string,
    panelId?: string,
    timeFrom?: string,
    range?: TimeRange
  ) => {
    const params = buildParams({ useCurrentTimeRange, selectedTheme, panelId, timeFrom, range });
    const editOrViewPanel = params.get('editPanel') ?? params.get('viewPanel') ?? '';
    params.set('panelId', editOrViewPanel);
    params.delete('editPanel');
    params.delete('viewPanel');

    const soloUrl = getDashboardUrl({
      absolute: true,
      soloRoute: true,
      uid: dashboard.state.uid,
      slug: dashboard.state.meta.slug,
      currentQueryParams: params.toString(),
    });
    return `<iframe src="${soloUrl}" width="450" height="200" frameborder="0"></iframe>`;
  };
