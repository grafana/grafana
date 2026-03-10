import { DataTopic, PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';

/**
 * Adds common text control options to a visualization options
 * @param builder
 * @public
 */

export function addAnnotationOptions<T>(builder: PanelOptionsEditorBuilder<T>) {
  const category = [t('grafana-ui.builder.annotations', 'Annotations')];

  builder.addBooleanSwitch({
    path: 'annotations.multiLane',
    category,
    name: t('grafana-ui.builder.annotations.multi-lane-name', 'Enable multi-row annotations'),
    description: t(
      'grafana-ui.builder.annotations.multi-row-desc',
      'Breaks each annotation frame into a separate row in the visualization'
    ),
    defaultValue: false,
    showIf: (_, __, annotations) =>
      annotations &&
      annotations?.filter((df) => df.meta?.dataTopic === DataTopic.Annotations && df.length > 0).length > 1,
  });
}
