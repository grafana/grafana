import { type EvaluationDetails } from '@openfeature/react-sdk';

import { reportInteraction } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';

import { isDashboardSceneLike } from '../../../../scene/types/dashboard';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { type PanelEditor } from '../../../PanelEditor';

// A panel editor outlives its query rows, including stacked-layout remounts.
const reportedDecisions = new WeakMap<PanelEditor, Set<string>>();

export function reportQueryCoauthoringDecision(
  panel: VizPanel,
  flag: Pick<EvaluationDetails<boolean>, 'value' | 'variant' | 'errorCode'>
) {
  if (flag.errorCode !== undefined) {
    return;
  }

  let variant: 'treatment' | 'control' | 'excluded' | undefined;
  switch (flag.variant) {
    case 'enabled':
      if (flag.value) {
        variant = 'treatment';
      }
      break;
    case 'disabled':
      if (!flag.value) {
        variant = 'control';
      }
      break;
    case 'excluded':
      if (!flag.value) {
        variant = 'excluded';
      }
      break;
  }

  if (!variant) {
    return;
  }

  if (!isDashboardSceneLike(panel.getRoot())) {
    return;
  }

  const dashboard = getDashboardSceneFor(panel);
  const editor = dashboard.state.editPanel;
  if (!editor || editor.getPanel() !== panel) {
    return;
  }

  const decisions = reportedDecisions.get(editor) ?? new Set<string>();
  if (decisions.has(variant)) {
    return;
  }
  decisions.add(variant);
  reportedDecisions.set(editor, decisions);

  const { edit_session_id } = dashboard.getEditSessionTracking();
  reportInteraction('grafana_query_coauthoring_availability_evaluated', {
    experiment_id: 'query_coauthoring',
    experiment_variant: variant,
    datasource_type: 'prometheus',
    dashboard_uid: dashboard.state.uid,
    panel_id: editor.getPanelId(),
    ...(edit_session_id ? { edit_session_id } : {}),
  });
}
