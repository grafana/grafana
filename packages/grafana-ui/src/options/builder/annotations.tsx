import { PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { OptionsWithLegend, OptionsWithTextFormatting } from '@grafana/schema';

/**
 * Adds common text control options to a visualization options
 * @param builder
 * @param withTitle
 * @public
 */
export function addAnnotationOptions<T extends OptionsWithLegend>(
  builder: PanelOptionsEditorBuilder<T>,
  defaultValue = false
) {
  const category = [t('grafana-ui.builder.annotations', 'Annotations')];

  builder.addBooleanSwitch({
    path: 'annotations.multiLane',
    category,
    name: t('grafana-ui.builder.annotations.multi-lane-name', 'Enable multi-lane annotations'),
    description: 'TODO',
    defaultValue,
  });
}
