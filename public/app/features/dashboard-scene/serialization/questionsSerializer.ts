import { type SceneObject } from '@grafana/scenes';
import { type Spec as DashboardV2Spec, type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type SceneQuestion } from '../questions/types';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

/**
 * The questions on `owner` as saved, with each picked panel named by its element, as the layout names it. A picked
 * panel that is no longer on the dashboard is left out, so every source names an element the dashboard saves.
 */
export function serializeQuestions(owner: SceneObject, questions: SceneQuestion[] | undefined): Question[] | undefined {
  if (!questions?.length) {
    return undefined;
  }

  let elementNames: Map<number, string> | undefined;
  const getElementName = (panelId: number) => {
    elementNames ??= getElementNamesByPanelId(owner);
    return elementNames.get(panelId);
  };

  return questions.map(({ sources, ...question }) => {
    const saved = (sources ?? []).flatMap(({ panelId, ...source }) => {
      const name = getElementName(panelId);
      return name ? [{ ...source, element: { kind: 'ElementReference' as const, name } }] : [];
    });
    return saved.length ? { ...question, sources: saved } : question;
  });
}

/**
 * The questions saved on a dashboard, row, or tab, with each picked panel named by its ID. A source naming an element
 * that `elements` doesn't have is left out: no panel answers it.
 */
export function deserializeQuestions(
  questions: Question[] | undefined,
  elements: DashboardV2Spec['elements']
): SceneQuestion[] | undefined {
  return questions?.map(({ sources, ...question }) => {
    const picked = (sources ?? []).flatMap(({ element, ...source }) => {
      // Saved JSON isn't validated, and a source that names nothing must not break the load.
      const name = element?.name;
      const panelId = name !== undefined && Object.hasOwn(elements, name) ? elements[name].spec.id : undefined;
      return panelId !== undefined && Number.isSafeInteger(panelId) ? [{ ...source, panelId }] : [];
    });
    return picked.length ? { ...question, sources: picked } : question;
  });
}

function getElementNamesByPanelId(owner: SceneObject): Map<number, string> {
  const dashboard = getDashboardSceneFor(owner);
  const names = new Map<number, string>();
  for (const panel of dashboard.state.body.getVizPanels()) {
    // Repeat clones share their source's ID, and a question only picks the source.
    if (!isRepeatCloneOrChildOf(panel)) {
      names.set(getPanelIdForVizPanel(panel), dashboardSceneGraph.getElementIdentifierForVizPanel(panel));
    }
  }
  return names;
}
