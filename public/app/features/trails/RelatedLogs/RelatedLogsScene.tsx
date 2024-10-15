import { useContext } from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { VAR_METRIC } from '../shared';

import { LogsIntegrationContext } from './LogsIntegrationScene';

export interface RelatedLogsSceneState extends SceneObjectState {}

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  constructor(state: Partial<RelatedLogsSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const {} = sceneGraph.getVariables(this);
  }

  static Component = ({ model }: SceneComponentProps<RelatedLogsScene>) => {
    const selectedMetricVar = sceneGraph.lookupVariable(VAR_METRIC, model);
    const selectedMetric = selectedMetricVar?.getValue()?.toString() ?? '';
    console.log(selectedMetric);
    const { findLogsDsForSelectedMetric } = useContext(LogsIntegrationContext);
    const lokiDs = findLogsDsForSelectedMetric(selectedMetric);

    return (
      <div>
        <h1>some logs will be here for this DS: {JSON.stringify(lokiDs)}</h1>
      </div>
    );
  };
}

export function buildRelatedLogsScene() {
  return new RelatedLogsScene({});
}
