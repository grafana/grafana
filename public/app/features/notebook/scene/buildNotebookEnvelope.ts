import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { type Resource } from 'app/features/apiserver/types';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

// transformSaveModelSchemaV2ToScene expects a DashboardWithAccessInfo<DashboardV2Spec>
// envelope. A notebook is fetched as a bare Resource<NotebookSpec> with no access
// block, so we hand-build the envelope the same way the assistant-preview path does.
//
// The spec cast is intentional: NotebookSpec and DashboardV2Spec share their leaf
// types but diverge on the layout/elements unions, so they are not assignable. The
// transformer dispatches on layout.kind at runtime and treats elements generically,
// so a notebook flows through once F7 registers the NotebookLayout deserializer.
// Until then the transform raises a runtime error (handled by the page's error state).
export function buildNotebookEnvelope(notebook: Resource<NotebookSpec>): DashboardWithAccessInfo<DashboardV2Spec> {
  return {
    apiVersion: notebook.apiVersion,
    kind: 'DashboardWithAccessInfo',
    metadata: notebook.metadata,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- see comment above: notebook/dashboard specs share leaves but diverge on unions
    spec: notebook.spec as unknown as DashboardV2Spec,
    access: {
      canSave: true,
      canEdit: true,
      canDelete: true,
      canShare: true,
      canStar: true,
    },
  };
}
