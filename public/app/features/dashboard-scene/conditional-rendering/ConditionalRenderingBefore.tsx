import { ReactNode } from 'react';

import { DateTime } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { DateTimePicker } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';

interface ConditionalRenderingBeforeState extends ConditionalRenderingBaseState<DateTime> {}

export class ConditionalRenderingBefore extends ConditionalRenderingBase<ConditionalRenderingBeforeState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.before.label', 'Before');
  }

  public evaluate(): boolean {
    const timeRange = sceneGraph.getTimeRange(this);
    return timeRange.state.value.from >= this.state.value;
  }

  public render(): ReactNode {
    return <ConditionalRenderingBeforeRenderer model={this} />;
  }
}

function ConditionalRenderingBeforeRenderer({ model }: SceneComponentProps<ConditionalRenderingBefore>) {
  const { value } = model.useState();

  return <DateTimePicker clearable={false} date={value} onChange={(value) => model.changeValue(value!)} />;
}
