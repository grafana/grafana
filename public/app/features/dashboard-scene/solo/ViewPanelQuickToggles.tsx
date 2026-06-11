import { useMemo } from 'react';

import { type PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { type OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

export interface Props {
  panel: VizPanel;
  plugin: PanelPlugin;
}

export function ViewPanelQuickToggles({ panel, plugin }: Props) {
  const { options, fieldConfig } = panel.useState();

  const optionHits = useMemo(() => {
    const quickToggles = plugin.viewPanelOptions?.quickToggles;
    if (!quickToggles) {
      return [];
    }

    const categories = getVisualizationOptions2({
      panel,
      plugin,
      eventBus: panel.getPanelContext().eventBus,
      instanceState: panel.getPanelContext().instanceState,
      currentOptions: options,
      currentFieldConfig: fieldConfig,
    });

    const toggles: OptionsPaneItemDescriptor[] = [];

    for (const category of categories) {
      for (const option of category.items) {
        if (quickToggles.optionProperties.includes(option.props.id)) {
          toggles.push(option);
        }
        if (quickToggles.fieldConfigProperties.includes(option.props.id)) {
          toggles.push(option);
        }
      }
    }

    return toggles;
  }, [panel, plugin, options, fieldConfig]);

  return (
    <OptionsPaneCategory
      id="quick-toggles"
      title={t('dashboard.sidebar.view-panel.quick-toggles', 'Quick toggles')}
      forceOpen={true}
    >
      {optionHits.map((hit) => hit.renderElement('asd'))}
    </OptionsPaneCategory>
  );
}
