import { PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { OptionsWithTextFormatting } from '@grafana/schema';

/**
 * Adds common text control options to a visualization options
 * @param builder
 * @param withTitle
 * @public
 */
export function addTextSizeOptions<T extends OptionsWithTextFormatting>(
  builder: PanelOptionsEditorBuilder<T>,
  withTitle = true
) {
  const category = [t('grafana-ui.builder.text.category-text-size', 'Text size')];
  if (withTitle) {
    builder.addNumberInput({
      path: 'text.titleSize',
      category,
      name: t('grafana-ui.builder.text.name-title', 'Title'),
      settings: {
        placeholder: t('grafana-ui.builder.text.placeholder-title', 'Auto'),
        integer: false,
        min: 1,
        max: 200,
      },
      defaultValue: undefined,
    });
  }

  builder.addNumberInput({
    path: 'text.valueSize',
    category,
    name: t('grafana-ui.builder.text.name-value', 'Value'),
    settings: {
      placeholder: t('grafana-ui.builder.text.placeholder-value', 'Auto'),
      integer: false,
      min: 1,
      max: 200,
    },
    defaultValue: undefined,
  });

  builder.addNumberInput({
    path: 'text.percentSize',
    category,
    name: t('grafana-ui.builder.text.name-percent-change', 'Percent change'),
    settings: {
      placeholder: t('grafana-ui.builder.text.placeholder-percent-change', 'Auto'),
      integer: false,
      min: 1,
      max: 200,
    },
    defaultValue: undefined,
  });
}
