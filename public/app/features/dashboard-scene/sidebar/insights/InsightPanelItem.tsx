import { t } from '@grafana/i18n';
import { SceneGridRow, sceneGraph, type SceneObject, type VizPanel } from '@grafana/scenes';
import { Button, IconButton, Stack } from '@grafana/ui';
import { InsightView } from 'app/plugins/panel/text/v2/insight/InsightView';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';

import { InsightCard } from './InsightCard';
import { moveInsightPanelToQuestion } from './insightMoves';
import { getInsightPanelOptions } from './insightPanels';
import { type InsightsDashboard } from './insightsStorage';
import { revealInsightSourcePanel } from './navigation';

interface Props {
  dashboard: InsightsDashboard;
  panel: VizPanel;
  /** The dashboard is being edited and can store saved questions. */
  canAuthor: boolean;
}

/**
 * An Insight panel's question, asked from the pane. It shares the panel's session, so an answer given
 * here shows on the panel, and the other way round.
 */
export function InsightPanelItem({ dashboard, panel, canAuthor }: Props) {
  const location = getPanelLocation(panel);

  return (
    <InsightCard>
      <Stack justifyContent="space-between" alignItems="center" gap={0.5}>
        <Button
          size="sm"
          variant="secondary"
          fill="text"
          icon="crosshair"
          tooltip={t('dashboard.insights.panels.go-to-panel', 'Go to panel')}
          onClick={() => revealInsightSourcePanel(panel)}
        >
          {location || t('dashboard.insights.panels.go-to-panel', 'Go to panel')}
        </Button>
        {canAuthor && (
          <IconButton
            name="arrow-right"
            size="sm"
            tooltip={t(
              'dashboard.insights.panels.move-to-questions',
              'Move to saved questions and remove the panel from the dashboard'
            )}
            onClick={() => moveInsightPanelToQuestion(dashboard, panel)}
          />
        )}
      </Stack>
      <InsightView
        dashboard={dashboard}
        sessionId={panel.state.key ?? ''}
        options={getInsightPanelOptions(panel)}
        fitContent
      />
    </InsightCard>
  );
}

/** Tab and row titles the viewer sees, outermost first. */
function getPanelLocation(panel: VizPanel): string {
  const titles: string[] = [];
  for (let parent = panel.parent; parent; parent = parent.parent) {
    const title = sceneGraph.interpolate(parent, getVisibleTitle(parent)).trim();
    if (title) {
      titles.unshift(title);
    }
  }
  return titles.join(' › ');
}

function getVisibleTitle(sceneObject: SceneObject): string {
  if (sceneObject instanceof TabItem || sceneObject instanceof SceneGridRow) {
    return sceneObject.state.title ?? '';
  }
  if (sceneObject instanceof RowItem && !sceneObject.state.hideHeader) {
    return sceneObject.state.title ?? '';
  }
  return '';
}
