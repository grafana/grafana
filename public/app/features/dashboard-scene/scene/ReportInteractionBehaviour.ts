import { reportInteraction } from '@grafana/runtime';
import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

export interface ReportInteractionBehaviourState extends SceneObjectState {}

export class ReportInteractionBehaviour extends SceneObjectBase<ReportInteractionBehaviourState> {
  public isReportInteractionBehavior: true = true;

  public reportInteraction(interactionName: string, properties?: Record<string, unknown>) {
    reportInteraction(interactionName, properties);
  }
}
