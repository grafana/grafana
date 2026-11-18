import { type Prompt, type PromptSource } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * A prompt as the dashboard scene holds it. It saves as a `Prompt`, whose sources name panels by element, as
 * layouts do. The scene names them by ID, as it names panels, and the v2 serializers convert between the two.
 */
export interface ScenePrompt extends Omit<Prompt, 'sources'> {
  /** The panels to answer it from. Unset for every panel in the dashboard, row, or tab the prompt is saved on. */
  sources?: ScenePromptSource[];
}

/** A panel that a prompt is answered from. */
interface ScenePromptSource extends Omit<PromptSource, 'element'> {
  panelId: number;
}
