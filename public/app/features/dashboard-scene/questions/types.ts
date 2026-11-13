import { type Question, type QuestionSource } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * A question as the dashboard scene holds it. It saves as a `Question`, whose sources name panels by element, as
 * layouts do. The scene names them by ID, as it names panels, and the v2 serializers convert between the two.
 */
export interface SceneQuestion extends Omit<Question, 'sources'> {
  /** The panels to answer it from. Unset for every panel in the dashboard, row, or tab the question is saved on. */
  sources?: SceneQuestionSource[];
}

/** A panel that a question is answered from. */
export interface SceneQuestionSource extends Omit<QuestionSource, 'element'> {
  panelId: number;
}
