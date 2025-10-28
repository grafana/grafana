import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableFieldOptions } from '@grafana/schema';
import icnTablePanelSvg from 'app/plugins/panel/table/img/icn-table-panel.svg';

import { Options } from './panelcfg.gen';

export class TableSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<Options, TableFieldOptions>({
      name: t('table.suggestions.name', 'Table'),
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
          imgSrc: icnTablePanelSvg,
        },
      });
    } else {
      list.append({});
    }
  }
}
