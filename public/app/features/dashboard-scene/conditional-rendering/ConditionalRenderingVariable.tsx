import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Trans } from 'app/core/internationalization';

interface ConditionalRenderingVariableState extends SceneObjectState {
  value: { name: string; values: string[] };
}

export class ConditionalRenderingVariable extends SceneObjectBase<ConditionalRenderingVariableState> {
  public static Component = ConditionalRenderingVariableRenderer;

  // TODO: Implement evaluate method
  public evaluate(): boolean {
    return true;
  }
}

function ConditionalRenderingVariableRenderer({}: SceneComponentProps<ConditionalRenderingVariable>) {
  return <Trans i18nKey="dashboard.conditional-rendering.variable">Here it should be variable editor</Trans>;
}
