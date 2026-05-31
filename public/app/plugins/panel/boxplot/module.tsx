import { type Field, FieldType, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';

import { BoxplotPanel } from './BoxplotPanel';
import { getBoxplotFieldsInfo } from './fields';
import { type FieldConfig, type Options, defaultFieldConfig } from './panelcfg.gen';

const numericFieldFilter = (field: Field) => field.type === FieldType.number;

export const plugin = new PanelPlugin<Options, FieldConfig>(BoxplotPanel)
  .useFieldConfig({
    useCustomConfig: (builder) => {
      builder
        .addSliderInput({
          path: 'lineWidth',
          name: t('boxplot.name-line-width', 'Line width'),
          defaultValue: defaultFieldConfig.lineWidth,
          settings: { min: 0, max: 10, step: 1 },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: t('boxplot.name-fill-opacity', 'Fill opacity'),
          defaultValue: defaultFieldConfig.fillOpacity,
          settings: { min: 0, max: 100, step: 1 },
        });

      commonOptionsBuilder.addAxisConfig(builder, defaultFieldConfig);
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    const category = [t('boxplot.category', 'Box plot')];
    const fieldsInfo = getBoxplotFieldsInfo();

    for (const dim of Object.values(fieldsInfo)) {
      builder.addFieldNamePicker({
        path: `fields.${dim.key}`,
        name: dim.name,
        description: dim.description,
        category,
        settings: {
          filter: numericFieldFilter,
          placeholderText: t('boxplot.field-placeholder', 'Auto'),
        },
      });
    }

    builder
      .addSliderInput({
        path: 'boxWidth',
        name: t('boxplot.name-box-width', 'Box width'),
        category,
        defaultValue: 0.6,
        settings: { min: 0.1, max: 1, step: 0.05 },
      })
      .addSliderInput({
        path: 'outlierSize',
        name: t('boxplot.name-outlier-size', 'Outlier size'),
        category,
        defaultValue: 4,
        settings: { min: 1, max: 20, step: 1 },
      });

    commonOptionsBuilder.addTooltipOptions(builder, true);
  });
