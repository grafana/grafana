/**
 * Notebook ↔ dashboard-spec bridging.
 *
 * A notebook is a sibling resource in the dashboard API group that rides the dashboard scene:
 * it reuses `PanelKind`/`LibraryPanelKind`, adds `CellKind`, and replaces the dashboard layout
 * union with a single `NotebookLayout`. It has no variables, annotations, links, cursorSync,
 * liveNow, preload, editable or revision. The panel reuse is near-total but not literal: the
 * notebook is v2beta1, so its transformations carry the v2beta1 wire shape (see below).
 *
 * Everything that builds or reads a scene is dashboard-typed, so a notebook has to be widened
 * into a `DashboardV2Spec` on the way in and narrowed back on the way out. Both directions live
 * here so the overlay/projection field lists cannot drift apart, and so callers on either side
 * (the notebook page loader, the full-spec mutation commands) share one implementation.
 */

import {
  defaultSpec as defaultDashboardV2Spec,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import { normalizeTransformation, toWireTransformation, type WireTransformation } from './transformationCompat';

/** Layout kind, and the layout registry id, that identifies a notebook. */
const NOTEBOOK_LAYOUT_KIND = 'NotebookLayout';

/**
 * A notebook is always a v2beta1 resource, so its panels carry the v2beta1 transformation shape
 * (`{ kind: <id>, spec: { id: <id>, … } }`) while everything inside the scene — and everything
 * `transformSceneToSaveModelSchemaV2` emits — is v2 stable (`{ kind: 'Transformation',
 * group: <id>, spec: { … } }`).
 *
 * The dashboard save path picks a wire shape from the resolved dashboard API version, which says
 * nothing about notebooks, so the conversion is pinned here instead. Without it a notebook that
 * round-trips through a scene comes back with panels the notebook schema does not describe: the
 * read side happens to survive (buildVizPanel normalizes either shape) but a save would persist
 * an off-schema transformation, and validation would reject it.
 */
const NOTEBOOK_WIRE_VERSION = 'v2beta1';

/**
 * Structural view of the one path both wire shapes share. Typing it loosely here (rather than
 * against either generated `PanelKind`) is what lets a single walk serve both directions; the
 * conversion itself stays fully typed inside `transformationCompat`.
 */
type PanelElementWithTransformations = {
  kind: string;
  spec: { data?: { spec?: { transformations?: WireTransformation[] } } };
};

function hasTransformations(element: unknown): element is PanelElementWithTransformations {
  if (typeof element !== 'object' || element === null || !('kind' in element) || element.kind !== 'Panel') {
    return false;
  }
  const spec: unknown = 'spec' in element ? element.spec : undefined;
  const data: unknown = typeof spec === 'object' && spec !== null && 'data' in spec ? spec.data : undefined;
  const dataSpec: unknown = typeof data === 'object' && data !== null && 'spec' in data ? data.spec : undefined;
  const transformations: unknown =
    typeof dataSpec === 'object' && dataSpec !== null && 'transformations' in dataSpec
      ? dataSpec.transformations
      : undefined;
  return Array.isArray(transformations) && transformations.length > 0;
}

/**
 * Rewrite every Panel element's transformations with `convert`, leaving other element kinds and
 * transformation-free panels untouched (returned by reference, so the common case allocates
 * nothing).
 */
function mapPanelTransformations(
  elements: Record<string, unknown>,
  convert: (transformation: WireTransformation) => unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [name, element] of Object.entries(elements ?? {})) {
    if (!hasTransformations(element)) {
      out[name] = element;
      continue;
    }

    const data = element.spec.data!;
    out[name] = {
      ...element,
      spec: {
        ...element.spec,
        data: {
          ...data,
          spec: {
            ...data.spec,
            transformations: data.spec!.transformations!.map(convert),
          },
        },
      },
    };
  }

  return out;
}

/**
 * Widen a `NotebookSpec` into the `DashboardV2Spec` shape the scene transformer expects.
 *
 * The transformer reads dashboard-only fields (`links`, `cursorSync`, `editable`, `preload`,
 * `variables`, `annotations`) directly, so the notebook's own fields are overlaid on the
 * dashboard defaults rather than assembled standalone: every field the transformer touches
 * then exists. `elements` and `layout` carry the notebook's sibling kinds, which the layout
 * serializer registry dispatches on `kind` at runtime.
 */
export function notebookSpecToDashboardSpec(notebook: NotebookSpec): DashboardV2Spec {
  const spec = {
    ...defaultDashboardV2Spec(),
    title: notebook.title,
    // `description` is optional on a notebook but a required string on the dashboard spec; keep
    // the default '' rather than writing undefined over it.
    description: notebook.description ?? '',
    tags: notebook.tags,
    timeSettings: notebook.timeSettings,
    // Upgrade panel transformations from the notebook's v2beta1 wire shape to the v2 stable shape
    // the scene and its serializer speak, so the result really is a valid DashboardV2Spec.
    elements: mapPanelTransformations(notebook.elements, normalizeTransformation),
    layout: notebook.layout,
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- notebook overlays dashboard defaults; layout/elements are the notebook's sibling kinds
  return spec as unknown as DashboardV2Spec;
}

/**
 * Narrow a serialized dashboard spec back down to a `NotebookSpec`.
 *
 * The scene serializer always emits the full dashboard shape, so a notebook round-tripped
 * through a scene comes back carrying `variables: []`, `annotations: []`, `cursorSync`,
 * `liveNow`, `preload`, `editable` and `links` — fields a `NotebookSpec` must not contain.
 * This drops them by construction (it names the notebook's fields rather than deleting the
 * dashboard's), so a field added to the dashboard spec later cannot leak through.
 *
 * `description` is dropped when empty: it is optional on a notebook, and the widening above
 * substitutes '' for absent, so an empty string round-trips back to absent.
 */
export function dashboardSpecToNotebookSpec(spec: DashboardV2Spec): NotebookSpec {
  const notebook = {
    title: spec.title,
    ...(spec.description ? { description: spec.description } : {}),
    tags: spec.tags,
    timeSettings: spec.timeSettings,
    // Downgrade panel transformations back to the notebook's v2beta1 wire shape.
    // normalizeTransformation first so the downgrade is total: it is a no-op on the v2 shape the
    // serializer emits, and idempotent if a spec somehow already carries the v2beta1 shape.
    elements: mapPanelTransformations(spec.elements, (transformation) =>
      toWireTransformation(normalizeTransformation(transformation), NOTEBOOK_WIRE_VERSION)
    ),
    layout: spec.layout,
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- elements/layout are the notebook's sibling kinds riding the dashboard-typed serializer
  return notebook as unknown as NotebookSpec;
}

/**
 * A layout manager rendering a notebook. Structural rather than `instanceof NotebookLayoutManager`
 * so this module stays free of the layout-manager import (which would pull the scene component
 * tree into the serialization and mutation-api layers).
 */
type NotebookLayoutLike = {
  descriptor: { id: string };
  setState: (state: { title?: string; tags?: string[] }) => void;
};

function hasNotebookDescriptor(body: unknown): body is NotebookLayoutLike {
  return (
    typeof body === 'object' &&
    body !== null &&
    'descriptor' in body &&
    typeof body.descriptor === 'object' &&
    body.descriptor !== null &&
    'id' in body.descriptor &&
    body.descriptor.id === NOTEBOOK_LAYOUT_KIND
  );
}

/**
 * Whether this scene renders a notebook rather than a dashboard.
 *
 * Tolerates a scene without state: this runs from permission checks and command dispatch, which
 * are reached before a handler has touched the scene, and answering "not a notebook" is the safe
 * reading — it routes to the dashboard rules the caller had before notebooks existed.
 */
export function isNotebookScene(scene: { state?: { body?: unknown } } | undefined): boolean {
  return hasNotebookDescriptor(scene?.state?.body);
}

/**
 * Push the notebook's title and tags onto its layout manager, which renders the document header.
 *
 * The manager deliberately does not read them off the parent `DashboardScene` (that import would
 * form a dependency cycle), so whoever builds or rebuilds the scene has to hand them down. Both
 * the initial load and the full-spec apply go through here so a rebuild cannot silently blank
 * the header.
 */
export function setNotebookDocumentHeader(body: unknown, title: string | undefined, tags: string[] | undefined): void {
  if (hasNotebookDescriptor(body)) {
    body.setState({ title, tags });
  }
}
