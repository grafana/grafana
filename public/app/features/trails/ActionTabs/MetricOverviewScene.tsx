import { PromMetricsMetadataItem } from '@grafana/prometheus';
import {
  QueryVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Stack, Text, TextLink } from '@grafana/ui';

import { MetricScene } from '../MetricScene';
import { StatusWrapper } from '../StatusWrapper';
import { reportExploreMetrics } from '../interactions';
import { VAR_DATASOURCE_EXPR, VAR_GROUP_BY } from '../shared';
import { getMetricSceneFor, getTrailFor } from '../utils';

export interface MetricOverviewSceneState extends SceneObjectState {
  metadata?: PromMetricsMetadataItem;
  metadataLoading?: boolean;
}

export class MetricOverviewScene extends SceneObjectBase<MetricOverviewSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE_EXPR],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<MetricOverviewSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private getVariable(): QueryVariable {
    const variable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!(variable instanceof QueryVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private _onActivate() {
    this.updateMetadata();
  }

  private onReferencedVariableValueChanged() {
    this.updateMetadata();
  }

  private async updateMetadata() {
    this.setState({ metadataLoading: true, metadata: undefined });
    const metricScene = getMetricSceneFor(this);
    const metric = metricScene.state.metric;

    const trail = getTrailFor(this);
    const metadata = await trail.getMetricMetadata(metric);
    this.setState({ metadata, metadataLoading: false });
  }

  public static Component = ({ model }: SceneComponentProps<MetricOverviewScene>) => {
    const { metadata, metadataLoading } = model.useState();
    const variable = model.getVariable();
    const { loading: labelsLoading, options: labelOptions } = variable.useState();

    const help = metadata?.help;
    const type = metadata?.type;
    const unit = metadata?.unit;

    return (
      <StatusWrapper isLoading={labelsLoading || metadataLoading}>
        <Stack gap={6}>
          <>
            <Stack direction="column" gap={0.5}>
              <Text weight={textWeight(help)}>Description</Text>
              <div style={{ maxWidth: 360 }}>{help}</div>
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={textWeight(type)}>Type</Text>
              {type}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={textWeight(unit)}>Unit</Text>
              {unit}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>Labels</Text>
              {labelOptions.length === 0 && 'Unable to fetch labels.'}
              {labelOptions.map((l) => (
                <TextLink
                  key={l.label}
                  href={`#View breakdown for ${l.label}`}
                  title={`View breakdown for ${l.label}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    sceneGraph.getAncestor(model, MetricScene).setActionView('breakdown');
                    const groupByVar = sceneGraph.lookupVariable(VAR_GROUP_BY, model);
                    if (groupByVar instanceof QueryVariable && l.label != null) {
                      reportExploreMetrics('label_selected', { label: l.label, cause: 'overview_link' });
                      groupByVar.setState({ value: l.value });
                    }
                    return false;
                  }}
                >
                  {l.label!}
                </TextLink>
              ))}
            </Stack>
          </>
        </Stack>
      </StatusWrapper>
    );
  };
}

export function buildMetricOverviewScene() {
  return new MetricOverviewScene({});
}

function textWeight(data: string | undefined) {
  return data ? 'medium' : 'light';
}
