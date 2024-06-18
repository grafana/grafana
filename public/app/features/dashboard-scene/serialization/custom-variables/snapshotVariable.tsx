import { Observable, map, of } from 'rxjs';

import { AdHocVariableFilter } from '@grafana/data';
import {
  MultiValueVariable,
  MultiValueVariableState,
  SceneComponentProps,
  ValidateAndUpdateResult,
  VariableDependencyConfig,
  VariableValueOption,
  renderSelectForVariable,
  sceneGraph,
  VariableGetOptionsArgs,
} from '@grafana/scenes';
import { AdHocFilterRenderer } from 'app/features/variables/adhoc/picker/AdHocFilterRenderer';

export interface SnapshotVariableState extends MultiValueVariableState {
  query: string;
  filters: AdHocVariableFilter[];
  isReadOnly: boolean;
}

export class SnapshotVariable extends MultiValueVariable<SnapshotVariableState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: [],
  });

  public constructor(initialState: Partial<SnapshotVariableState>) {
    super({
      type: 'snapshot',
      isReadOnly: true,
      query: '',
      value: '',
      text: '',
      options: [],
      filters: [],
      name: '',
      ...initialState,
    });
  }

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    const interpolated = sceneGraph.interpolate(this, this.state.query);
    const match = interpolated.match(/(?:\\,|[^,])+/g) ?? [];

    const options = match.map((text) => {
      text = text.replace(/\\,/g, ',');
      const textMatch = /^(.+)\s:\s(.+)$/g.exec(text) ?? [];
      if (textMatch.length === 3) {
        const [, key, value] = textMatch;
        return { label: key.trim(), value: value.trim() };
      } else {
        return { label: text.trim(), value: text.trim() };
      }
    });

    return of(options);
  }

  public validateAndUpdate(): Observable<ValidateAndUpdateResult> {
    return this.getValueOptions({}).pipe(
      map((options) => {
        if (this.state.options !== options) {
          this._updateValueGivenNewOptions(options);
        }
        return {};
      })
    );
  }

  public static Component = ({ model }: SceneComponentProps<MultiValueVariable<SnapshotVariableState>>) => {
    //if filters are present, render the filter component
    // model can have filters or not, so we need to check
    if (model.state.filters && model.state.filters.length > 0) {
      return model.state.filters.map((filter) => {
        return AdHocFilterRenderer({
          filter,
          disabled: true,
          datasource: { uid: '' },
          allFilters: [],
          onKeyChange: () => {},
          onOperatorChange: () => {},
          onValueChange: () => {},
        });
      });
    }
    //TODO:fix the typescript error
    return renderSelectForVariable(model);
  };
  // we will always preserve the current value and text for snapshots
  private _updateValueGivenNewOptions(options: VariableValueOption[]) {
    const { value: currentValue, text: currentText } = this.state;
    const stateUpdate: Partial<MultiValueVariableState> = {
      options,
      loading: false,
      value: currentValue ?? [],
      text: currentText ?? [],
    };

    this.setState(stateUpdate);
  }
}
