import { VisualizationSuggestionsBuilder, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableFieldOptions } from '@grafana/schema';
import icnTextPanelSvg from 'app/plugins/panel/text/img/icn-text-panel.svg';

import { Options } from './panelcfg.gen';

export class TextSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options, TableFieldOptions> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, TableFieldOptions>({
      name: t('text.suggestions.name', 'Text'),
      pluginId: 'text',
      cardOptions: {
        imgSrc: icnTextPanelSvg,
      },
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    // only suggest text panel when there is no data
    if (builder.dataSummary.fieldCount > 0) {
      return;
    }

    this.getListAppender(builder).append({});
  }
}
