import { Cmdk } from './Cmdk';
import { useRegisterDashboardSearchSource } from './sources/dashboardSearchSource';
import { useRegisterDeepSearchSource } from './sources/deepSearchSource';
import { useRegisterRecentDashboardsSource } from './sources/recentDashboardsSource';
import { useRegisterScopesSource } from './sources/scopesSource';
import { useRegisterStaticActionsSource } from './sources/staticActionsSource';

/**
 * Composes the palette with the built-in sources, the same way the old palette registered its actions from
 * within the CommandPalette component. Keeps the core Cmdk component independent of any concrete source.
 */
export function CmdkRoot() {
  useRegisterStaticActionsSource();
  useRegisterRecentDashboardsSource();
  useRegisterDashboardSearchSource();
  useRegisterDeepSearchSource();
  useRegisterScopesSource();

  return <Cmdk />;
}
