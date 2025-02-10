import { ReactNode } from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { t, Trans } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';

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
}

function ConditionalRenderingVariableRenderer({}: SceneComponentProps<ConditionalRenderingVariable>) {
  return (
    <Trans i18nKey="dashboard.conditional-rendering.variable.placeholder">Here it should be variable editor</Trans>
  );
}
