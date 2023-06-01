import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { TableFieldOptions } from '@grafana/schema';
import { Options } from '@grafana/schema/src/raw/composable/table/panelcfg/x/TablePanelCfg_types.gen';
import { SuggestionName } from 'app/types/suggestions';

export class TableSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<Options, TableFieldOptions>({
      name: SuggestionName.Table,
      pluginId: 'table',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          s.fieldConfig!.defaults.custom!.minWidth = 50;
        },
      },
    });

    // If there are not data suggest table anyway but use icon instead of real preview
    if (builder.dataSummary.fieldCount === 0) {
      list.append({
        cardOptions: {
          imgSrc: 'public/app/plugins/panel/table/img/icn-table-panel.svg',
        },
      });
    } else {
      list.append({});
    }
  }
}
