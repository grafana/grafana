import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { DashboardTabs } from '../../DashboardTabs/DashboardTabs';
import { HomeSection } from '../../HomeSection';

/** Core widget: the existing dashboards tabs wrapped in a homepage card. */
export function DashboardsWidget() {
  const { components: assistantComponents } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageAssistant,
  });

  return (
    <HomeSection height="100%" display="flex" direction="column" gap={2}>
      {renderLimitedComponents({
        props: {},
        limit: 1,
        components: assistantComponents,
        pluginId: ASSISTANT_PLUGIN_ID,
      })}
      <DashboardTabs />
    </HomeSection>
  );
}
