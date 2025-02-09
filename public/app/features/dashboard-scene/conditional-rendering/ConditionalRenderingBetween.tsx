import { DateTime } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { DateTimePicker, InlineField, InlineFieldRow } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface ConditionalRenderingBetweenState extends SceneObjectState {
  value: {
    from: DateTime;
    to: DateTime;
  };
}

export class ConditionalRenderingBetween extends SceneObjectBase<ConditionalRenderingBetweenState> {
  public static Component = ConditionalRenderingBetweenRenderer;

  public evaluate(): boolean {
    const { from: trFrom, to: trTo } = sceneGraph.getTimeRange(this).state.value;
    const { from: stFrom, to: stTo } = this.state.value;
    return trFrom >= stFrom && trTo <= stTo;
  }

  public changeFrom(from: DateTime) {
    this.setState({ value: { from, to: from > this.state.value.to ? from : this.state.value.to } });
  }

  public changeTo(to: DateTime) {
    this.setState({ value: { from: to < this.state.value.from ? to : this.state.value.from, to } });
  }
}

function ConditionalRenderingBetweenRenderer({ model }: SceneComponentProps<ConditionalRenderingBetween>) {
  const {
    value: { from, to },
  } = model.useState();

  return (
    <InlineFieldRow>
      <InlineField label={t('dashboard.conditional-rendering.between.from', 'From')}>
        <DateTimePicker
          clearable={false}
          date={from}
          maxDate={to.toDate()}
          onChange={(value) => model.changeFrom(value!)}
        />
      </InlineField>
      <InlineField label={t('dashboard.conditional-rendering.between.to', 'To')}>
        <DateTimePicker
          clearable={false}
          date={to}
          minDate={from.toDate()}
          onChange={(value) => model.changeTo(value!)}
        />
      </InlineField>
    </InlineFieldRow>
  );
}
