import { sceneGraph, type SceneObject } from '@grafana/scenes';
import { type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { isDashboardSceneLike } from '../scene/types/dashboard';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

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

function remapQuestion(question: Question, copiedIds: Map<number, number>, keepOutside: boolean): Question {
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
 * IDs of the panels the questions on a dashboard and its rows and tabs picked, including panels removed since. A new
 * panel must not reuse one of them, or questions that picked the removed panel would answer from the new one.
 */
export function getPickedPanelIds(root: SceneObject): number[] {
  const questions = [
    ...(isDashboardSceneLike(root) ? (root.state.questions ?? []) : []),
    ...getSections(root).flatMap((section) => section.state.questions ?? []),
  ];
  // Saved JSON isn't validated, and a value that isn't an ID would break the next ID.
  return questions.flatMap((question) =>
    (question.sources ?? []).flatMap((source) => (Number.isSafeInteger(source.panelId) ? [source.panelId] : []))
  );
}

/** `object`, when it is a row or tab, and the rows and tabs inside it. */
function getSections(object: SceneObject): Array<RowItem | TabItem> {
  return [object, ...sceneGraph.findAllObjects(object, isSection)].filter(isSection);
}

function isSection(object: SceneObject): object is RowItem | TabItem {
  return object instanceof RowItem || object instanceof TabItem;
}
