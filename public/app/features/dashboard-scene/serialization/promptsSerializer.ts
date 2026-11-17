import { type SceneObject } from '@grafana/scenes';
import { type Spec as DashboardV2Spec, type Prompt } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type ScenePrompt } from '../prompts/types';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

/**
 * The prompts on `owner` as saved, with each picked panel named by its element, as the layout names it. A picked
 * panel that is no longer on the dashboard is left out, so every source names an element the dashboard saves.
 */
export function serializePrompts(owner: SceneObject, prompts: ScenePrompt[] | undefined): Prompt[] | undefined {
  if (!prompts?.length) {
    return undefined;
  }

  let elementNames: Map<number, string> | undefined;
  const getElementName = (panelId: number) => {
    elementNames ??= getElementNamesByPanelId(owner);
    return elementNames.get(panelId);
  };

  return prompts.map(({ sources, ...prompt }) => {
    const saved = (sources ?? []).flatMap(({ panelId, ...source }) => {
      const name = getElementName(panelId);
      return name ? [{ ...source, element: { kind: 'ElementReference' as const, name } }] : [];
    });
    return saved.length ? { ...prompt, sources: saved } : prompt;
  });
}

/**
 * The prompts saved on a dashboard, row, or tab, with each picked panel named by its ID. A source naming an element
 * that `elements` doesn't have is left out: no panel answers it.
 *
 * Saved JSON isn't validated, and neither is a spec applied through the mutation API, so this is where a prompt
 * becomes one the rest of the scene can rely on: sources that aren't a list are left out, and so is a title that
 * isn't a string.
 */
export function deserializePrompts(
  prompts: Prompt[] | undefined,
  elements: DashboardV2Spec['elements']
): ScenePrompt[] | undefined {
  return prompts?.map(({ sources, title, ...rest }) => {
    const prompt = typeof title === 'string' ? { ...rest, title } : rest;
    const picked = (Array.isArray(sources) ? sources : []).flatMap(({ element, ...source }) => {
      // A source that names nothing must not break the load.
      const name = element?.name;
      const panelId = name !== undefined && Object.hasOwn(elements, name) ? elements[name].spec.id : undefined;
      return panelId !== undefined && Number.isSafeInteger(panelId) ? [{ ...source, panelId }] : [];
    });
    return picked.length ? { ...prompt, sources: picked } : prompt;
  });
}

function getElementNamesByPanelId(owner: SceneObject): Map<number, string> {
  const dashboard = getDashboardSceneFor(owner);
  const names = new Map<number, string>();
  for (const panel of dashboard.state.body.getVizPanels()) {
    // Repeat clones share their source's ID, and a prompt only picks the source.
    if (!isRepeatCloneOrChildOf(panel)) {
      names.set(getPanelIdForVizPanel(panel), dashboardSceneGraph.getElementIdentifierForVizPanel(panel));
    }
  }
  return names;
}
