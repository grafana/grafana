import { DataFrame } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  sceneGraph,
  AdHocFiltersVariable,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';

import { reportExploreMetrics } from '../interactions';
import { VAR_OTEL_AND_METRIC_FILTERS, VAR_OTEL_GROUP_LEFT, VAR_OTEL_RESOURCES } from '../shared';
import { getTrailFor } from '../utils';

export interface AddToFiltersGraphActionState extends SceneObjectState {
  frame: DataFrame;
}

export class AddToFiltersGraphAction extends SceneObjectBase<AddToFiltersGraphActionState> {
  public onClick = () => {
    const variable = sceneGraph.lookupVariable('filters', this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    const labels = this.state.frame.fields[1]?.labels ?? {};
    if (Object.keys(labels).length !== 1) {
      return;
    }

    const labelName = Object.keys(labels)[0];
    reportExploreMetrics('label_filter_changed', { label: labelName, action: 'added', cause: 'breakdown' });
    const trail = getTrailFor(this);
    const resourceAttributes = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail);
    const allAttributes = resourceAttributes?.getValue();
    const filter = {
      key: labelName,
      operator: '=',
      value: labels[labelName],
    };
    // add to either label filters or otel resource filters
    if (
      allAttributes &&
      typeof allAttributes === 'string' &&
      // if the label chosen is a resource attribute, add it to the otel resource variable
      allAttributes?.split(',').includes(labelName)
    ) {
      // This is different than the first non-promoted labels on data trail. In data trail we look at all labels
      // for all metrics. In breakdown, we look at one metric.
      //
      // The metric may not have the label promoted so we have to compare not the non-promoted
      // label collection we use in the parent datatrail, but instead have to look at `VAR_OTEL_GROUP_LEFT`
      // which are a collection of labels from `target_info` that have not been promoted to the metric.
      //
      // These metric-specific non-promoted labels are retrieved in the function `getFilteredResourceAttributes`.
      // These attributes on the metric that has been selected.
      trail.setState({ addingLabelFromBreakdown: true });
      // add to OTel resource var filters
      const otelResourcesVar = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, trail);
      const otelAndMetricsResourcesVar = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
      if (
        !(
          otelResourcesVar instanceof AdHocFiltersVariable && otelAndMetricsResourcesVar instanceof AdHocFiltersVariable
        )
      ) {
        return;
      }

      otelResourcesVar.setState({ filters: [...otelResourcesVar.state.filters, filter] });
      otelAndMetricsResourcesVar.setState({ filters: [...otelAndMetricsResourcesVar.state.filters, filter] });
      trail.setState({ addingLabelFromBreakdown: false });
    } else {
      // add to regular var filters
      trail.addFilterWithoutReportingInteraction(filter);
    }
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    const state = model.useState();
    const labels = state.frame.fields[1]?.labels || {};

    const canAddToFilters = Object.keys(labels).length !== 0;

    if (!canAddToFilters) {
      return null;
    }

    return (
      <Button variant="secondary" size="sm" fill="solid" onClick={model.onClick}>
        Add to filters
      </Button>
    );
  };
}
