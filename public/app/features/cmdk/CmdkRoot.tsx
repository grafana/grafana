import { Cmdk } from './Cmdk';
import { useRegisterDashboardSearchSource } from './sources/dashboardSearchSource';
import { useRegisterStaticActionsSource } from './sources/staticActionsSource';

/**
 * Composes the palette with the built-in sources, the same way the old palette registered its actions from
 * within the CommandPalette component. Keeps the core Cmdk component independent of any concrete source.
 */
export function CmdkRoot() {
  useRegisterStaticActionsSource();
  useRegisterDashboardSearchSource();

  return <Cmdk />;
}
