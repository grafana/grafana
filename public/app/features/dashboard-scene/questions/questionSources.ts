import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { isDashboardSceneLike, type DashboardSceneLike } from '../scene/types/dashboard';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

import { type SceneQuestion } from './types';

/**
 * Points the questions saved on `copy`, and on the rows and tabs inside it, at the copies of the panels they picked in
 * `original`. `copy` must hold the same panels as `original`, in the same order, with new IDs: a duplicate, or the
 * same row or tab deserialized again with new IDs.
 *
 * A picked panel outside `original` is kept when `keepOutside` is set, since on the same dashboard its ID still names
 * the same panel. Otherwise it is dropped, and a question left with no picked panels is answered from every panel in
 * its row or tab.
 */
export function remapQuestionSources(
  original: RowItem | TabItem,
  copy: RowItem | TabItem,
  { keepOutside }: { keepOutside: boolean }
): void {
  const copiedPanels = copy.getLayout().getVizPanels();
  const copiedIds = new Map<number, number>();
  original
    .getLayout()
    .getVizPanels()
    .forEach((panel, index) => {
      const copied = copiedPanels[index];
      if (copied) {
        copiedIds.set(getPanelIdForVizPanel(panel), getPanelIdForVizPanel(copied));
      }
    });

  for (const section of getSections(copy)) {
    const { questions } = section.state;
    if (questions?.some((question) => question.sources?.length)) {
      section.setState({ questions: questions.map((question) => remapQuestion(question, copiedIds, keepOutside)) });
    }
  }
}

function remapQuestion(question: SceneQuestion, copiedIds: Map<number, number>, keepOutside: boolean): SceneQuestion {
  if (!question.sources?.length) {
    return question;
  }
  const sources = question.sources.flatMap((source) => {
    const panelId = copiedIds.get(source.panelId);
    if (panelId !== undefined) {
      return [{ ...source, panelId }];
    }
    return keepOutside ? [source] : [];
  });
  const { sources: _, ...rest } = question;
  return sources.length ? { ...rest, sources } : rest;
}

/**
 * Stops the questions on a dashboard and its rows and tabs from picking the panels inside `removed`, and returns a
 * function that puts them back. A new panel takes the ID of a removed one when that was the highest, and a question
 * that still picked it would then answer from the new panel.
 */
export function dropPickedPanels(root: SceneObject, removed: SceneObject): () => void {
  const removedIds = new Set(getVizPanels(removed).map(getPanelIdForVizPanel));
  const restores: Array<() => void> = [];

  if (removedIds.size) {
    for (const owner of getQuestionOwners(root)) {
      const { questions } = owner.state;
      if (questions?.some((question) => question.sources?.some((source) => removedIds.has(source.panelId)))) {
        owner.setState({ questions: questions.map((question) => dropSources(question, removedIds)) });
        restores.push(() => owner.setState({ questions }));
      }
    }
  }

  return () => restores.forEach((restore) => restore());
}

/** Returns a function that puts the questions on a dashboard and its rows and tabs back as they are now. */
export function snapshotQuestions(root: SceneObject): () => void {
  const snapshot = getQuestionOwners(root).flatMap((owner) =>
    owner.state.questions ? [{ owner, questions: owner.state.questions }] : []
  );
  return () => snapshot.forEach(({ owner, questions }) => owner.setState({ questions }));
}

function dropSources(question: SceneQuestion, panelIds: Set<number>): SceneQuestion {
  if (!question.sources?.some((source) => panelIds.has(source.panelId))) {
    return question;
  }
  const { sources, ...rest } = question;
  const kept = sources?.filter((source) => !panelIds.has(source.panelId)) ?? [];
  return kept.length ? { ...rest, sources: kept } : rest;
}

function getQuestionOwners(root: SceneObject): Array<DashboardSceneLike | RowItem | TabItem> {
  return [...(isDashboardSceneLike(root) ? [root] : []), ...getSections(root)];
}

/** `object`, when it is a panel, and the panels inside it. */
function getVizPanels(object: SceneObject): VizPanel[] {
  return [object, ...sceneGraph.findAllObjects(object, (child) => child instanceof VizPanel)].filter(
    (child) => child instanceof VizPanel
  );
}

/** `object`, when it is a row or tab, and the rows and tabs inside it. */
function getSections(object: SceneObject): Array<RowItem | TabItem> {
  return [object, ...sceneGraph.findAllObjects(object, isSection)].filter(isSection);
}

function isSection(object: SceneObject): object is RowItem | TabItem {
  return object instanceof RowItem || object instanceof TabItem;
}
