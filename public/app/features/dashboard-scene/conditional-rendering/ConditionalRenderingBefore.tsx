import { ReactNode } from 'react';

import { DateTime } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { DateTimePicker, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { handleDeleteNonGroupCondition } from './shared';

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

  public onDelete() {
    handleDeleteNonGroupCondition(this);
  }
}

function ConditionalRenderingBeforeRenderer({ model }: SceneComponentProps<ConditionalRenderingBefore>) {
  const { value } = model.useState();

  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <DateTimePicker clearable={false} date={value} onChange={(value) => model.changeValue(value!)} />
    </Stack>
  );
}
