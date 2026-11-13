import { type ControlSourceRef } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * Predefined variables are org-wide (global) and folder-scoped Variable resources
 * (`dashboard.grafana.app/v2beta1`) that are injected into every V2 dashboard at load
 * time. They are runtime-only: tagging them with an `origin` keeps them out of the
 * persisted dashboard spec and out of the editable variables list.
 */

interface GlobalControlSourceRef {
  type: 'global';
}

interface FolderControlSourceRef {
  type: 'folder';
  folderUid: string;
}

export type PredefinedControlSourceRef = GlobalControlSourceRef | FolderControlSourceRef;

/**
 * The schema (and scenes) `ControlSourceRef` union currently only has the
 * `datasource` member. Predefined variables reuse the same `origin` mechanism —
 * which drives save-filtering and read-only editor behavior — with their own
 * source types. Widening the published union is a follow-up; until then this is
 * the single sanctioned cast between the two shapes.
 */
export function toControlSourceRef(ref: PredefinedControlSourceRef): ControlSourceRef {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ref as unknown as ControlSourceRef;
}

export function isPredefinedOrigin(origin: unknown): origin is PredefinedControlSourceRef {
  return (
    typeof origin === 'object' &&
    origin !== null &&
    'type' in origin &&
    (origin.type === 'global' || origin.type === 'folder')
  );
}

/**
 * Widens an `origin` back to the predefined shape. Prefer this over the type guard
 * when the input is typed as the published `ControlSourceRef` union — narrowing that
 * union with the guard collapses to `never` because it only has the datasource member.
 */
export function getPredefinedOrigin(origin: unknown): PredefinedControlSourceRef | undefined {
  return isPredefinedOrigin(origin) ? origin : undefined;
}
