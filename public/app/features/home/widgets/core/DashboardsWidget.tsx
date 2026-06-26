import { type ComponentTypeWithExtensionMeta } from '@grafana/data';
import { renderLimitedComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { DashboardTabs } from '../../DashboardTabs/DashboardTabs';
import { type HomepageTabExtensionProps } from '../../DashboardTabs/types';
import { HomeSection } from '../../HomeSection';

interface Props {
  assistantComponents?: Array<ComponentTypeWithExtensionMeta<{}>>;
  tabComponents?: Array<ComponentTypeWithExtensionMeta<HomepageTabExtensionProps>>;
}

/** Core widget: the existing dashboards tabs wrapped in a homepage card. */
export function DashboardsWidget({ assistantComponents = [], tabComponents = [] }: Props) {
  return (
    <HomeSection height="100%" display="flex" direction="column" gap={2}>
      {renderLimitedComponents({
        props: {},
        limit: 1,
        components: assistantComponents,
        pluginId: ASSISTANT_PLUGIN_ID,
      })}
      <DashboardTabs extensionComponents={tabComponents} />
    </HomeSection>
  );
}
