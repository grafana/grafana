import {
  defaultSpec as defaultDashboardV2Spec,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { type Resource } from 'app/features/apiserver/types';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

// transformSaveModelSchemaV2ToScene expects a DashboardWithAccessInfo<DashboardV2Spec>
// envelope. A notebook is fetched as a bare Resource<NotebookSpec> with no access
// block, so we hand-build the envelope the same way the assistant-preview path does.
export function buildNotebookEnvelope(notebook: Resource<NotebookSpec>): DashboardWithAccessInfo<DashboardV2Spec> {
  // A NotebookSpec omits dashboard-only fields the transformer reads directly (links,
  // cursorSync, editable, preload, variables, annotations). Overlay the notebook's own
  // fields on the dashboard defaults so every field the transformer touches exists;
  // elements/layout are the notebook's sibling kinds, dispatched on kind at runtime.
  const spec = {
    ...defaultDashboardV2Spec(),
    title: notebook.spec.title,
    // description is optional on a notebook but a required string on the dashboard spec; keep the
    // default '' rather than writing undefined over it.
    description: notebook.spec.description ?? '',
    tags: notebook.spec.tags,
    timeSettings: notebook.spec.timeSettings,
    elements: notebook.spec.elements,
    layout: notebook.spec.layout,
  };

  return {
    apiVersion: notebook.apiVersion,
    kind: 'DashboardWithAccessInfo',
    metadata: notebook.metadata,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- notebook overlays dashboard defaults; layout/elements are the notebook's sibling kinds
    spec: spec as unknown as DashboardV2Spec,
    // The notebook view is read-only, so every permission is denied. This is honest rather than
    // relying only on the scene's isEmbedded flag to hide edit/share affordances.
    access: {
      canSave: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canStar: false,
    },
  };
}
