import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { type Resource } from 'app/features/apiserver/types';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { notebookSpecToDashboardSpec } from '../serialization/notebookSpecTransform';

// transformSaveModelSchemaV2ToScene expects a DashboardWithAccessInfo<DashboardV2Spec>
// envelope. A notebook is fetched as a bare Resource<NotebookSpec> with no access
// block, so we hand-build the envelope the same way the assistant-preview path does.
export function buildNotebookEnvelope(notebook: Resource<NotebookSpec>): DashboardWithAccessInfo<DashboardV2Spec> {
  return {
    apiVersion: notebook.apiVersion,
    kind: 'DashboardWithAccessInfo',
    metadata: notebook.metadata,
    spec: notebookSpecToDashboardSpec(notebook.spec),
    // The notebook view is read-only to hand editing, so every dashboard permission is denied.
    // This is honest rather than relying only on the scene's isEmbedded flag to hide edit/share
    // affordances. It deliberately does NOT govern the full-spec mutation commands: those carry
    // their own notebook permission rule, because an assistant writing into an open notebook is
    // the point of the resource (see requiresNotebookEdit in mutation-api/commands/types).
    access: {
      canSave: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canStar: false,
    },
  };
}
