import { PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';

/**
 * Adds common text control options to a visualization options
 * @param builder
 * @param withTitle
 * @public
 */
export function addAnnotationOptions<T>(builder: PanelOptionsEditorBuilder<T>, defaultValue = false) {
  const category = [t('grafana-ui.builder.annotations', 'Annotations')];

  builder.addBooleanSwitch({
    path: 'annotations.multiLane',
    category,
    name: t('grafana-ui.builder.annotations.multi-lane-name', 'Enable multi-lane annotations'),
    description: t(
      'grafana-ui.builder.annotations.multi-lane-desc',
      'Breaks each annotation frame into a separate row in the visualization'
    ),
    defaultValue,
  });
}
