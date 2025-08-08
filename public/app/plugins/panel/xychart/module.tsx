import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';

import { SeriesEditor } from './SeriesEditor';
import { XYChartPanel2 } from './XYChartPanel';
import { getScatterFieldConfig } from './config';
import { xyChartMigrationHandler } from './migrations';
import { FieldConfig, defaultFieldConfig, Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options, FieldConfig>(XYChartPanel2)
  // .setPanelChangeHandler(xyChartChangeHandler)
  .setMigrationHandler(xyChartMigrationHandler)
  .useFieldConfig(getScatterFieldConfig(defaultFieldConfig))
  .setPanelOptions((builder) => {
    const category = [t('xychart.category-xychart', 'XY Chart')];
    builder
      .addRadio({
        path: 'mapping',
        name: t('xychart.name-series-mapping', 'Series mapping'),
        category,
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'auto', label: t('xychart.series-mapping-options.label-auto', 'Auto') },
            { value: 'manual', label: t('xychart.series-mapping-options.label-manual', 'Manual') },
          ],
        },
      })
      .addCustomEditor({
        id: 'series',
        path: 'series',
        name: '',
        category,
        editor: SeriesEditor,
        defaultValue: [{}],
      });

    commonOptionsBuilder.addTooltipOptions(builder, true);
    commonOptionsBuilder.addLegendOptions(builder);
  });
