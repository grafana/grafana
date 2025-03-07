import { ReactNode } from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { Stack } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { handleDeleteNonGroupCondition } from './shared';

interface Value {
  name: string;
  values: string[];
}

interface ConditionalRenderingVariableState extends ConditionalRenderingBaseState<Value> {
  value: Value;
}

export class ConditionalRenderingVariable extends ConditionalRenderingBase<ConditionalRenderingVariableState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.variable.label', 'Variable');
  }

  // TODO: Implement evaluate method
  public evaluate(): boolean {
    return true;
  }

  public render(): ReactNode {
    return <ConditionalRenderingVariableRenderer model={this} />;
  }

  public onDelete() {
    handleDeleteNonGroupCondition(this);
  }
}

function ConditionalRenderingVariableRenderer({ model }: SceneComponentProps<ConditionalRenderingVariable>) {
  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <Trans i18nKey="dashboard.conditional-rendering.variable.placeholder">Here it should be variable editor</Trans>
    </Stack>
  );
}
