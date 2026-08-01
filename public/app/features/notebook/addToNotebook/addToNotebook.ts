import { rangeUtil, type RawTimeRange } from '@grafana/data';
import { type NotebookElement } from '@grafana/schema/apis/notebook/v2beta1';

import { createNotebook, fetchNotebook, saveNotebook } from '../api/notebookAPI';
import { insertElement, newNotebookSpec, type CellSource } from '../model/notebookSpec';

export type AddToNotebookTarget = { type: 'new'; title: string } | { type: 'existing'; uid: string };

export interface AddToNotebookResult {
  uid: string;
  title: string;
  /** Name of the newly added element — used to scroll it into view when opening the notebook. */
  elementName: string;
}

/**
 * Adds an element (typically a panel captured from a dashboard or Explore) to a
 * notebook. For a new notebook the source time range becomes the notebook's time
 * range; when adding to an existing notebook the panel follows the notebook's
 * global time range (the private-preview default). With `lockTimeRange`, the
 * panel is instead pinned to the absolute time window it was captured in.
 */
export async function addElementToNotebook(
  target: AddToNotebookTarget,
  element: NotebookElement,
  options?: { timeRange?: RawTimeRange; source?: CellSource; lockTimeRange?: boolean }
): Promise<AddToNotebookResult> {
  // Lock resolves the range to absolute timestamps: "the window I was looking at",
  // not "the last 6 hours from whenever the notebook is opened".
  const timeOverride = options?.lockTimeRange && options.timeRange ? resolveToAbsolute(options.timeRange) : undefined;

  if (target.type === 'new') {
    const from = options?.timeRange ? rawToString(options.timeRange.from) : undefined;
    const to = options?.timeRange ? rawToString(options.timeRange.to) : undefined;
    const base = newNotebookSpec(target.title, { from, to });
    const { spec, elementName } = insertElement(base, element, { source: options?.source, timeOverride });
    const created = await createNotebook(spec);
    return { uid: created.metadata.name, title: created.spec.title, elementName };
  }

  const notebook = await fetchNotebook(target.uid);
  const { spec, elementName } = insertElement(notebook.spec, element, { source: options?.source, timeOverride });
  const saved = await saveNotebook({ ...notebook, spec });
  return { uid: saved.metadata.name, title: saved.spec.title, elementName };
}

function resolveToAbsolute(raw: RawTimeRange): { from: string; to: string } {
  const range = rangeUtil.convertRawToRange(raw);
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

function rawToString(value: RawTimeRange['from']): string {
  return typeof value === 'string' ? value : value.toISOString();
}
