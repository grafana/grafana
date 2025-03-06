import { ReactNode } from 'react';

import { DateTime } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { DateTimePicker } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';

interface ConditionalRenderingAfterState extends ConditionalRenderingBaseState<DateTime> {}

export class ConditionalRenderingAfter extends ConditionalRenderingBase<ConditionalRenderingAfterState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.after.label', 'After');
  }

  public evaluate(): boolean {
    const timeRange = sceneGraph.getTimeRange(this);
    return timeRange.state.value.from >= this.state.value;
  }

  public render(): ReactNode {
    return <ConditionalRenderingAfterRenderer model={this} />;
  }
}

function ConditionalRenderingAfterRenderer({ model }: SceneComponentProps<ConditionalRenderingAfter>) {
  const { value } = model.useState();

  return <DateTimePicker clearable={false} date={value} onChange={(value) => model.changeValue(value!)} />;
}
