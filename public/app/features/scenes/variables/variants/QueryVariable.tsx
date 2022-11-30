import { isNumber, sortBy, toLower, uniqBy } from 'lodash';
import React from 'react';
import { Observable, Subject, of } from 'rxjs';

import { DataSourceApi, DataSourceRef, stringToJsRegex, VariableRefresh, VariableSort } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { sceneGraph } from '../../core/sceneGraph';
import { SceneComponentProps } from '../../core/types';
import { VariableDependencyConfig } from '../VariableDependencyConfig';
import { VariableValueSelect } from '../components/VariableValueSelect';
import { VariableValueOption } from '../types';

import { MultiValueVariable, MultiValueVariableState, VariableGetOptionsArgs } from './MultiValueVariable';

export interface QueryVariableState extends MultiValueVariableState {
  datasource: DataSourceRef | null;
  query: any;
  regex: string;
  refresh: VariableRefresh;
  sort: VariableSort;
}

export class QueryVariable extends MultiValueVariable<QueryVariableState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['regex'], // TODO: add query support
  });

  public constructor(initialState: Partial<QueryVariableState>) {
    super({
      name: '',
      value: '',
      text: '',
      query: '',
      options: [],
      datasource: null,
      regex: '',
      refresh: VariableRefresh.onDashboardLoad,
      sort: VariableSort.alphabeticalAsc,
      ...initialState,
    });
  }

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    if (this.state.query === '' || !this.state.datasource) {
      return of([]);
    }

    // Get closest variables set
    const vars = sceneGraph.getVariables(this);
    // Use its runner
    const runner = vars.getRunner();

    return new Observable<VariableValueOption[]>((observer) => {
      const dsSubject = new Subject<DataSourceApi>();

      // Wait for the data source to be ready
      dsSubject.subscribe({
        next: (ds) => {
          runner
            .runQueries({
              datasource: ds,
              variable: this.state,
              timeRange: sceneGraph.getTimeRange(this).state,
            })
            .subscribe({
              next: (data) => {
                console.log('data', data);
                let regex = '';
                if (this.state.regex) {
                  regex = sceneGraph.interpolate(this, this.state.regex, undefined, 'regex');
                }

                observer.next(metricNamesToVariableValues(regex, this.state.sort, data));
              },
            });
        },
        error: (e) => observer.error(e),
      });

      // Resolve variable's data soure
      getDataSourceSrv()
        .get(this.state.datasource ?? '')
        .then((ds) => {
          dsSubject.next(ds);
        })
        .catch((err) => {
          dsSubject.error(err);
        });
    });
  }

  public static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    return <VariableValueSelect model={model} />;
  };
}

export const metricNamesToVariableValues = (variableRegEx: string, sort: VariableSort, metricNames: any[]) => {
  let regex;
  let options: VariableValueOption[] = [];

  if (variableRegEx) {
    regex = stringToJsRegex(variableRegEx);
  }

  for (let i = 0; i < metricNames.length; i++) {
    const item = metricNames[i];
    let text = item.text === undefined || item.text === null ? item.value : item.text;
    let value = item.value === undefined || item.value === null ? item.text : item.value;

    if (isNumber(value)) {
      value = value.toString();
    }

    if (isNumber(text)) {
      text = text.toString();
    }

    if (regex) {
      const matches = getAllMatches(value, regex);
      if (!matches.length) {
        continue;
      }

      const valueGroup = matches.find((m) => m.groups && m.groups.value);
      const textGroup = matches.find((m) => m.groups && m.groups.text);
      const firstMatch = matches.find((m) => m.length > 1);
      const manyMatches = matches.length > 1 && firstMatch;

      if (valueGroup || textGroup) {
        value = valueGroup?.groups?.value ?? textGroup?.groups?.text;
        text = textGroup?.groups?.text ?? valueGroup?.groups?.value;
      } else if (manyMatches) {
        for (let j = 0; j < matches.length; j++) {
          const match = matches[j];
          options.push({ label: match[1], value: match[1] });
        }
        continue;
      } else if (firstMatch) {
        text = firstMatch[1];
        value = firstMatch[1];
      }
    }

    options.push({ label: text, value: value });
  }

  options = uniqBy(options, 'value');
  return sortVariableValues(options, sort);
};

const getAllMatches = (str: string, regex: RegExp): RegExpExecArray[] => {
  const results: RegExpExecArray[] = [];
  let matches = null;

  regex.lastIndex = 0;

  do {
    matches = regex.exec(str);
    if (matches) {
      results.push(matches);
    }
  } while (regex.global && matches && matches[0] !== '' && matches[0] !== undefined);

  return results;
};

export const sortVariableValues = (options: any[], sortOrder: VariableSort) => {
  if (sortOrder === VariableSort.disabled) {
    return options;
  }

  const sortType = Math.ceil(sortOrder / 2);
  const reverseSort = sortOrder % 2 === 0;

  if (sortType === 1) {
    options = sortBy(options, 'text');
  } else if (sortType === 2) {
    options = sortBy(options, (opt) => {
      if (!opt.text) {
        return -1;
      }

      const matches = opt.text.match(/.*?(\d+).*/);
      if (!matches || matches.length < 2) {
        return -1;
      } else {
        return parseInt(matches[1], 10);
      }
    });
  } else if (sortType === 3) {
    options = sortBy(options, (opt) => {
      return toLower(opt.text);
    });
  }

  if (reverseSort) {
    options = options.reverse();
  }

  return options;
};
