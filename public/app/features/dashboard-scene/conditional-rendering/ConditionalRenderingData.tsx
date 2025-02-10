import { ReactNode } from 'react';

import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Switch } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';

interface ConditionalRenderingDataState extends ConditionalRenderingBaseState<boolean> {}

export class ConditionalRenderingData extends ConditionalRenderingBase<ConditionalRenderingDataState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.data.label', 'Data');
  }

  public evaluate(): boolean {
    return (sceneGraph.getData(this).state.data?.series.length ?? 0) > 0;
  }

  public render(): ReactNode {
    return <ConditionalRenderingDataRenderer model={this} />;
  }
}

function ConditionalRenderingDataRenderer({ model }: SceneComponentProps<ConditionalRenderingData>) {
  const { value } = model.useState();

  return <Switch value={value} onChange={() => model.changeValue(!value)} />;
}
