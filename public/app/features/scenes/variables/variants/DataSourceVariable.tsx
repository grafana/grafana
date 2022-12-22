import { Observable, of } from 'rxjs';

import { stringToJsRegex, DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { sceneGraph } from '../../core/sceneGraph';
import { SceneComponentProps } from '../../core/types';
import { VariableDependencyConfig } from '../VariableDependencyConfig';
import { renderSelectForVariable } from '../components/VariableValueSelect';
import { VariableValueOption } from '../types';

import { MultiValueVariable, MultiValueVariableState, VariableGetOptionsArgs } from './MultiValueVariable';

export interface DataSourceVariableState extends MultiValueVariableState {
  query: string;
  regex: string;
}

export class DataSourceVariable extends MultiValueVariable<DataSourceVariableState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['regex'],
  });

  public constructor(initialState: Partial<DataSourceVariableState>) {
    super({
      type: 'datasource',
      value: '',
      text: '',
      options: [],
      name: '',
      regex: '',
      query: '',
      ...initialState,
    });
  }

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    if (!this.state.query) {
      return of([]);
    }

    const dataSourceTypes = this.getDataSourceTypes();

    let regex;
    if (this.state.regex) {
      const interpolated = sceneGraph.interpolate(this, this.state.regex, undefined, 'regex');
      regex = stringToJsRegex(interpolated);
    }

    const options: VariableValueOption[] = [];

    for (let i = 0; i < dataSourceTypes.length; i++) {
      const source = dataSourceTypes[i];
      // must match on type
      if (source.meta.id !== this.state.query) {
        continue;
      }

      if (isValid(source, regex)) {
        options.push({ label: source.name, value: source.name });
      }

      if (isDefault(source, regex)) {
        options.push({ label: 'default', value: 'default' });
      }
    }

    if (options.length === 0) {
      options.push({ label: 'No data sources found', value: '' });
    }

    return of(options);
  }

  private getDataSourceTypes(): DataSourceInstanceSettings[] {
    return getDataSourceSrv().getList({ metrics: true, variables: false });
  }

  public static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    return renderSelectForVariable(model);
  };
}

function isValid(source: DataSourceInstanceSettings, regex?: RegExp) {
  if (!regex) {
    return true;
  }

  return regex.exec(source.name);
}

function isDefault(source: DataSourceInstanceSettings, regex?: RegExp) {
  if (!source.isDefault) {
    return false;
  }

  if (!regex) {
    return true;
  }

  return regex.exec('default');
}
