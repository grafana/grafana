import { DataTopic } from '@grafana/data/types';
import type { PanelOptionsEditorBuilder } from '@grafana/data/utils';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import type * as common from '@grafana/schema';

import { CanvasControlsSwitchEditor } from './CanvasControlsSwitchEditor';
import { ClusteringSwitchEditor, DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED } from './ClusteringSwitchEditor';

/**
 * Adds common text control options to a visualization options
 * @param builder
 * @public
 */

export function addAnnotationOptions<T extends common.OptionsWithAnnotations>(builder: PanelOptionsEditorBuilder<T>) {
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

  builder.addCustomEditor({
    editor: ClusteringSwitchEditor,
    id: 'clusteringSwitchEditor',
    path: 'annotations.clustering',
    category,
    name: t('grafana-ui.builder.annotations.clustering.name', 'Enable annotation clustering'),
    description: t(
      'grafana-ui.builder.annotations.clustering.desc',
      'Combines high density point annotations into region annotations'
    ),
    defaultValue: DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED,
    showIf: (_, __, annotations) =>
      config.featureToggles.annotationsClustering &&
      annotations?.some((df) => df.meta?.dataTopic === DataTopic.Annotations),
  });

  builder.addCustomEditor({
    editor: CanvasControlsSwitchEditor,
    id: 'canvasSwitchEditor',
    path: 'annotations',
    category,
    name: t('grafana-ui.builder.annotations.canvasControls.name', 'Hide lines and areas'),
    description: t(
      'grafana-ui.builder.annotations.canvasControls.desc',
      'Hides annotation indicator lines and shaded regions'
    ),
    defaultValue: undefined,
    showIf: (_, __, annotations) =>
      config.featureToggles.annotationsClustering &&
      annotations?.some((df) => df.meta?.dataTopic === DataTopic.Annotations),
  });
}
