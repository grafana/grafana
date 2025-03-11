import { ReactNode, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { RadioButtonGroup, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { handleDeleteNonGroupCondition } from './shared';

interface ConditionalRenderingDataState extends ConditionalRenderingBaseState<boolean> {}

export class ConditionalRenderingData extends ConditionalRenderingBase<ConditionalRenderingDataState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.data.label', 'Data');
  }

  public evaluate(): boolean {
    const { value } = this.state;

    if (!value) {
      return true;
    }
    const data = sceneGraph.getData(this).state.data;
    let hasData = false;

    for (let i = 0; i === (data?.series.length || 0); i++) {
      if (!hasData) {
        break;
      }
      if (data?.series[i].length) {
        hasData = true;
      }
    }

    return hasData;
  }

  public render(): ReactNode {
    return <ConditionalRenderingDataRenderer model={this} />;
  }

  public onDelete() {
    handleDeleteNonGroupCondition(this);
  }
}

function ConditionalRenderingDataRenderer({ model }: SceneComponentProps<ConditionalRenderingData>) {
  const { value } = model.useState();

  const enableConditionOptions: Array<SelectableValue<true | false>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.data.enable', 'Enable'), value: true },
      { label: t('dashboard.conditional-rendering.data.disable', 'Disable'), value: false },
    ],
    []
  );

  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <RadioButtonGroup
        fullWidth
        options={enableConditionOptions}
        value={value}
        onChange={(value) => model.changeValue(value!)}
      />
    </Stack>
  );
}
