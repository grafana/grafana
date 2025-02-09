import { DateTime } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { DateTimePicker, InlineField } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface ConditionalRenderingToState extends SceneObjectState {
  value: DateTime;
}

export class ConditionalRenderingTo extends SceneObjectBase<ConditionalRenderingToState> {
  public static Component = ConditionalRenderingToRenderer;

  public evaluate(): boolean {
    const timeRange = sceneGraph.getTimeRange(this);
    return timeRange.state.value.to <= this.state.value;
  }

  public changeValue(value: DateTime) {
    this.setState({ value });
  }
}

function ConditionalRenderingToRenderer({ model }: SceneComponentProps<ConditionalRenderingTo>) {
  const { value } = model.useState();

  return (
    <InlineField label={t('dashboard.conditional-rendering.to', 'To')}>
      <DateTimePicker clearable={false} date={value} onChange={(value) => model.changeValue(value!)} />
    </InlineField>
  );
}
