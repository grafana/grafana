import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Checkbox, InlineField } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface ConditionalRenderingDataState extends SceneObjectState {
  value: boolean;
}

export class ConditionalRenderingData extends SceneObjectBase<ConditionalRenderingDataState> {
  public static Component = ConditionalRenderingDataRenderer;

  public evaluate(): boolean {
    return (sceneGraph.getData(this).state.data?.series.length ?? 0) > 0;
  }

  public toggleValue() {
    this.setState({ value: !this.state.value });
  }
}

function ConditionalRenderingDataRenderer({ model }: SceneComponentProps<ConditionalRenderingData>) {
  const { value } = model.useState();

  return (
    <InlineField label={t('dashboard.conditional-rendering.data', 'Has data')}>
      <Checkbox value={value} onChange={() => model.toggleValue()} />
    </InlineField>
  );
}
