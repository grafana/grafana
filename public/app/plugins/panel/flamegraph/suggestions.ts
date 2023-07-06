import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SuggestionName } from 'app/types/suggestions';

import { FlameGraphDataContainer as FlameGraphDataContainer } from './components/FlameGraph/dataTransform';
import { FlameGraphDataContainer as FlameGraphDataContainerV2 } from './flamegraphV2/components/FlameGraph/dataTransform';

export class FlameGraphSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<{}, {}>({
      name: SuggestionName.FlameGraph,
      pluginId: 'flamegraph',
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    if (!builder.data) {
      return;
    }

    // Try to instantiate FlameGraphDataContainer (depending on the version), since the instantiation can fail due
    // to the format of the data - meaning that a Flame Graph cannot be used to visualize those data.
    // Without this check, a suggestion containing an error is shown to the user.
    const dataFrame = builder.data.series[0];
    try {
      config.featureToggles.flameGraphV2
        ? new FlameGraphDataContainerV2(dataFrame)
        : new FlameGraphDataContainer(dataFrame);
    } catch (err) {
      return;
    }

    this.getListWithDefaults(builder).append({
      name: SuggestionName.FlameGraph,
    });
  }
}
