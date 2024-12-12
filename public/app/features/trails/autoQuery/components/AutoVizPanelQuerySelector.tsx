import { SceneObjectState, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';

import { getMetricSceneFor } from '../../utils';
import { AutoQueryDef } from '../types';

interface QuerySelectorState extends SceneObjectState {
  queryDef: AutoQueryDef;
  onChangeQuery: (variant: string) => void;
  options?: Array<{
    label: string;
    value: string;
  }>;
}

export class AutoVizPanelQuerySelector extends SceneObjectBase<QuerySelectorState> {
  constructor(state: QuerySelectorState) {
    super(state);
    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    const { autoQuery } = getMetricSceneFor(this).state;

    if (autoQuery.variants.length === 0) {
      return;
    }

    this.setState({ options: autoQuery.variants.map((q) => ({ label: q.variant, value: q.variant })) });
  }

  public static Component = ({ model }: SceneComponentProps<AutoVizPanelQuerySelector>) => {
    const { options, onChangeQuery, queryDef } = model.useState();

    if (!options) {
      return null;
    }

    return <RadioButtonGroup size="sm" options={options} value={queryDef.variant} onChange={onChangeQuery} />;
  };
}
