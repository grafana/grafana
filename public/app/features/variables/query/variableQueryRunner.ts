import { from, merge, Observable, of, OperatorFunction, Subject, throwError, Unsubscribable } from 'rxjs';
import { catchError, filter, finalize, map, mergeMap, takeUntil } from 'rxjs/operators';
import {
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DefaultTimeRange,
  FieldType,
  getFieldDisplayName,
  LoadingState,
  MetricFindValue,
  PanelData,
  ScopedVars,
} from '@grafana/data';

import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { getVariable } from '../state/selectors';
import { QueryVariableModel, VariableRefresh } from '../types';
import { runRequest } from '../../dashboard/state/runRequest';
import { updateVariableOptions, updateVariableTags } from './reducer';
import { StoreState, ThunkDispatch } from '../../../types';
import { dispatch, getState } from '../../../store/store';
import { getLegacyQueryOptions, getTemplatedRegex } from '../utils';
import { validateVariableSelectionState } from '../state/actions';
import { v4 as uuidv4 } from 'uuid';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { hasCustomVariableSupport, hasDatasourceVariableSupport, hasStandardVariableSupport } from '../guard';

interface UpdateOptionsArgs {
  identifier: VariableIdentifier;
  dataSource: DataSourceApi;
  searchFilter?: string;
}

export interface UpdateOptionsResults {
  state: LoadingState;
  identifier: VariableIdentifier;
  error?: any;
}

interface VariableQueryRunnerArgs {
  dispatch: ThunkDispatch;
  getState: () => StoreState;
  getVariable: typeof getVariable;
  getTemplatedRegex: typeof getTemplatedRegex;
  getTimeSrv: typeof getTimeSrv;
}

class VariableQueryRunner {
  private readonly updateOptionsRequests: Subject<UpdateOptionsArgs>;
  private readonly updateOptionsResults: Subject<UpdateOptionsResults>;
  private readonly cancelRequests: Subject<{ identifier: VariableIdentifier }>;
  private readonly subscription: Unsubscribable;
  private readonly queryRunners: QueryRunner[];

  constructor(
    private dependencies: VariableQueryRunnerArgs = { dispatch, getState, getVariable, getTemplatedRegex, getTimeSrv }
  ) {
    this.updateOptionsRequests = new Subject<UpdateOptionsArgs>();
    this.updateOptionsResults = new Subject<UpdateOptionsResults>();
    this.cancelRequests = new Subject<{ identifier: VariableIdentifier }>();
    this.onNewRequest = this.onNewRequest.bind(this);
    this.runUpdateTagsRequest = this.runUpdateTagsRequest.bind(this);
    this.subscription = this.updateOptionsRequests.subscribe(this.onNewRequest);
    this.queryRunners = [new StandardQueryRunner(), new CustomQueryRunner(), new DatasourceQueryRunner()];
  }

  queueRequest(args: UpdateOptionsArgs): void {
    this.updateOptionsRequests.next(args);
  }

  getResponse(identifier: VariableIdentifier): Observable<UpdateOptionsResults> {
    return this.updateOptionsResults.asObservable().pipe(filter(result => result.identifier === identifier));
  }

  cancelRequest(identifier: VariableIdentifier): void {
    this.cancelRequests.next({ identifier });
  }

  destroy(): void {
    this.subscription.unsubscribe();
  }

  onNewRequest(args: UpdateOptionsArgs): void {
    const { dataSource, identifier, searchFilter } = args;
    try {
      const beforeUid = getState().templating.transaction.uid;

      const variableInState = this.dependencies.getVariable<QueryVariableModel>(
        identifier.id,
        this.dependencies.getState()
      );

      this.updateOptionsResults.next({ identifier, state: LoadingState.Loading });

      const runnerArgs = { variable: variableInState, dataSource, searchFilter };
      const runner = this.queryRunners.find(runner => runner.canRun(runnerArgs));

      if (!runner) {
        this.updateOptionsResults.next({
          identifier,
          state: LoadingState.Error,
          error: new Error("Couldn't find specific query runner with supplied arguments."),
        });
        return;
      }

      const target = runner.getTarget(runnerArgs);
      if (!target) {
        this.updateOptionsResults.next({
          identifier,
          state: LoadingState.Error,
          error: new Error("Couldn't create specific target with supplied arguments."),
        });
        return;
      }

      const request = this.getRequest(variableInState, args, target);

      runner
        .runRequest(runnerArgs, request)
        .pipe(
          filter(() => {
            // lets check if we started another batch during the execution of the observable. If so we just want to abort the rest.
            const afterUid = getState().templating.transaction.uid;
            return beforeUid === afterUid;
          }),
          this.toMetricFindValues(),
          mergeMap(results => {
            const templatedRegex = this.dependencies.getTemplatedRegex(variableInState);
            const payload = toVariablePayload(variableInState, { results, templatedRegex });
            this.dependencies.dispatch(updateVariableOptions(payload));

            return this.runUpdateTagsRequest(variableInState, args);
          }),
          mergeMap(() => {
            // If we are searching options there is no need to validate selection state
            // This condition was added to as validateVariableSelectionState will update the current value of the variable
            // So after search and selection the current value is already update so no setValue, refresh & url update is performed
            // The if statement below fixes https://github.com/grafana/grafana/issues/25671
            if (!searchFilter) {
              return from(
                this.dependencies.dispatch(validateVariableSelectionState(toVariableIdentifier(variableInState)))
              );
            }

            return of([]);
          }),
          takeUntil(
            merge(this.updateOptionsRequests, this.cancelRequests).pipe(
              filter(args => {
                let cancelRequest = false;

                if (args.identifier.id === identifier.id) {
                  cancelRequest = true;
                }

                return cancelRequest;
              })
            )
          ),
          catchError(error => {
            if (error.cancelled) {
              return of({});
            }

            this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
            return throwError(error);
          }),
          finalize(() => {
            this.updateOptionsResults.next({ identifier, state: LoadingState.Done });
          })
        )
        .subscribe();
    } catch (error) {
      this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
    }
  }

  runUpdateTagsRequest(variable: QueryVariableModel, args: UpdateOptionsArgs): Observable<MetricFindValue[]> {
    const { dataSource, searchFilter } = args;

    if (variable.useTags && dataSource.metricFindQuery) {
      return from(dataSource.metricFindQuery(variable.tagsQuery, getLegacyQueryOptions(variable, searchFilter))).pipe(
        map(tagResults => {
          this.dependencies.dispatch(updateVariableTags(toVariablePayload(variable, tagResults)));
          return tagResults;
        })
      );
    }

    return of([]);
  }

  private getRequest(variable: QueryVariableModel, args: UpdateOptionsArgs, target: DataQuery) {
    const { searchFilter } = args;
    const variableAsVars = { variable: { text: variable.current.text, value: variable.current.value } };
    const searchFilterScope = { searchFilter: { text: searchFilter, value: searchFilter } };
    const searchFilterAsVars = searchFilter ? searchFilterScope : {};
    const scopedVars = { ...searchFilterAsVars, ...variableAsVars } as ScopedVars;
    const range =
      variable.refresh === VariableRefresh.onTimeRangeChanged
        ? this.dependencies.getTimeSrv().timeRange()
        : DefaultTimeRange;

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: uuidv4(),
      timezone: '',
      range,
      interval: '',
      intervalMs: 0,
      targets: [target],
      scopedVars,
      startTime: Date.now(),
    };

    return request;
  }

  private toMetricFindValues(): OperatorFunction<PanelData, MetricFindValue[]> {
    return source =>
      source.pipe(
        map(panelData => {
          const frames = panelData.series;
          if (!frames || !frames.length) {
            return [];
          }

          if (VariableQueryRunner.areMetricFindValues(frames)) {
            return frames;
          }

          const metrics: MetricFindValue[] = [];

          let valueIndex: number | null = null;
          let textIndex: number | null = null;
          let stringIndex: number | null = null;
          let expandableIndex: number | null = null;

          for (const frame of frames) {
            for (let index = 0; index < frame.fields.length; index++) {
              const field = frame.fields[index];
              const fieldName = getFieldDisplayName(field, frame, frames).toLowerCase();

              if (field.type === FieldType.string && !stringIndex) {
                stringIndex = index;
              }

              if (fieldName === 'text' && field.type === FieldType.string && !textIndex) {
                textIndex = index;
              }

              if (fieldName === 'value' && field.type === FieldType.string && !valueIndex) {
                valueIndex = index;
              }

              if (
                fieldName === 'expandable' &&
                (field.type === FieldType.boolean || field.type === FieldType.number) &&
                !expandableIndex
              ) {
                expandableIndex = index;
              }
            }
          }

          if (!stringIndex) {
            return [];
          }

          for (const frame of frames) {
            for (let index = 0; index < frame.length; index++) {
              const expandable = expandableIndex ? frame.fields[expandableIndex].values.get(index) : undefined;
              const string = frame.fields[stringIndex].values.get(index);
              const text = textIndex ? frame.fields[textIndex].values.get(index) : string;
              const value = valueIndex ? frame.fields[valueIndex].values.get(index) : text;

              metrics.push({ text, value, expandable });
            }
          }

          return metrics;
        })
      );
  }

  private static areMetricFindValues(data: any[]): data is MetricFindValue[] {
    if (!data) {
      return false;
    }

    if (!data.length) {
      return true;
    }

    const firstValue: any = data[0];
    return (
      (firstValue.hasOwnProperty('text') && typeof firstValue.text === 'string') ||
      (firstValue.hasOwnProperty('Text') && typeof firstValue.Text === 'string') ||
      (firstValue.hasOwnProperty('value') && typeof firstValue.value === 'string') ||
      (firstValue.hasOwnProperty('Value') && typeof firstValue.Value === 'string')
    );
  }
}

export interface RunnerArgs {
  dataSource: DataSourceApi;
  searchFilter?: string;
  variable: QueryVariableModel;
}

export interface QueryRunner {
  canRun: (args: RunnerArgs) => boolean;
  getTarget: (args: RunnerArgs) => DataQuery | null;
  runRequest: (args: RunnerArgs, request: DataQueryRequest) => Observable<PanelData>;
}

export function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: DefaultTimeRange });
}

export class StandardQueryRunner implements QueryRunner {
  canRun({ dataSource }: RunnerArgs) {
    return hasStandardVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: RunnerArgs) {
    if (!hasStandardVariableSupport(dataSource)) {
      return null;
    }

    return dataSource.variables.standard.toDataQuery(variable.query);
  }

  runRequest({ dataSource }: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!dataSource.variables.standard.query) {
      runRequest(dataSource, request);
    }

    return runRequest(dataSource, request, dataSource.variables.standard.query);
  }
}

export class CustomQueryRunner implements QueryRunner {
  canRun({ dataSource }: RunnerArgs) {
    return hasCustomVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: RunnerArgs) {
    if (!hasCustomVariableSupport(dataSource)) {
      return null;
    }

    return variable.query;
  }

  runRequest({ dataSource }: RunnerArgs, request: DataQueryRequest) {
    if (!hasCustomVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(dataSource, request, dataSource.variables.custom.query);
  }
}

export class DatasourceQueryRunner implements QueryRunner {
  canRun({ dataSource }: RunnerArgs) {
    return hasDatasourceVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: RunnerArgs) {
    if (!hasDatasourceVariableSupport(dataSource)) {
      return null;
    }

    return variable.query;
  }

  runRequest({ dataSource }: RunnerArgs, request: DataQueryRequest) {
    if (!hasDatasourceVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(dataSource, request);
  }
}

export const variableQueryRunner = new VariableQueryRunner();
