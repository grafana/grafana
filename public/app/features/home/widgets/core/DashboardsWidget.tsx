import { DashboardTabs } from '../../DashboardTabs/DashboardTabs';
import { HomeSection } from '../../HomeSection';

/** Core widget: the existing dashboards tabs wrapped in a homepage card. */
export function DashboardsWidget() {
  return (
    <HomeSection height="100%" display="flex" direction="column">
      <DashboardTabs />
    </HomeSection>
  );
}
