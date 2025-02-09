import { DateTime } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { DateTimePicker, InlineField } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface ConditionalRenderingFromState extends SceneObjectState {
  value: DateTime;
}

export class ConditionalRenderingFrom extends SceneObjectBase<ConditionalRenderingFromState> {
  public static Component = ConditionalRenderingFromRenderer;

  public evaluate(): boolean {
    const timeRange = sceneGraph.getTimeRange(this);
    return timeRange.state.value.from >= this.state.value;
  }

  public changeValue(value: DateTime) {
    this.setState({ value });
  }
}

function ConditionalRenderingFromRenderer({ model }: SceneComponentProps<ConditionalRenderingFrom>) {
  const { value } = model.useState();

  return (
    <InlineField label={t('dashboard.conditional-rendering.from', 'From')}>
      <DateTimePicker clearable={false} date={value} onChange={(value) => model.changeValue(value!)} />
    </InlineField>
  );
}
