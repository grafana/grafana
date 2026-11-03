import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { canReadNotebooks } from 'app/features/notebook/permissions';

import { getComponentIdFromComponentMeta } from './extensionSidebarUtils';

// Reserved ids for panels rendered by core rather than a plugin. They never appear in
// `availableComponents`, so the provider and renderer special-case them.
export const CORE_NOTEBOOKS_PLUGIN_ID = 'grafana-core-notebooks';
export const CORE_NOTEBOOKS_COMPONENT_TITLE = 'Notebooks';
export const CORE_NOTEBOOKS_COMPONENT_ID = getComponentIdFromComponentMeta(
  CORE_NOTEBOOKS_PLUGIN_ID,
  CORE_NOTEBOOKS_COMPONENT_TITLE
);

export function useCanUseCoreNotebooksSidebar(): boolean {
  const enabled = useFlagDashboardNotebooks();
  return enabled && canReadNotebooks();
}
