import { from, merge, Observable, of, OperatorFunction, Subject, throwError, Unsubscribable } from 'rxjs';
import { catchError, filter, finalize, first, map, mergeMap, takeUntil } from 'rxjs/operators';
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
import { updateVariableOptions, updateVariableTags } from './reducer';
import { StoreState, ThunkDispatch } from '../../../types';
import { dispatch, getState } from '../../../store/store';
import { getLegacyQueryOptions, getTemplatedRegex } from '../utils';
import { validateVariableSelectionState } from '../state/actions';
import { v4 as uuidv4 } from 'uuid';
import { getTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { getQueryRunners, QueryRunner } from './queryRunners';

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
  getQueryRunners: typeof getQueryRunners;
}

class VariableQueryRunner {
  private readonly updateOptionsRequests: Subject<UpdateOptionsArgs>;
  private readonly updateOptionsResults: Subject<UpdateOptionsResults>;
  private readonly cancelRequests: Subject<{ identifier: VariableIdentifier }>;
  private readonly subscription: Unsubscribable;
  private readonly queryRunners: QueryRunner[];

  constructor(
    private dependencies: VariableQueryRunnerArgs = {
      dispatch,
      getState,
      getVariable,
      getTemplatedRegex,
      getTimeSrv,
      getQueryRunners,
    }
  ) {
    this.updateOptionsRequests = new Subject<UpdateOptionsArgs>();
    this.updateOptionsResults = new Subject<UpdateOptionsResults>();
    this.cancelRequests = new Subject<{ identifier: VariableIdentifier }>();
    this.onNewRequest = this.onNewRequest.bind(this);
    this.runUpdateTagsRequest = this.runUpdateTagsRequest.bind(this);
    this.subscription = this.updateOptionsRequests.subscribe(this.onNewRequest);
    this.queryRunners = this.dependencies.getQueryRunners();
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

      this.updateOptionsResults.next({ identifier, state: LoadingState.Loading });

      const variable = this.dependencies.getVariable<QueryVariableModel>(identifier.id, this.dependencies.getState());
      const dispatch = this.dependencies.dispatch;
      const getTemplatedRegexFunc = this.dependencies.getTemplatedRegex;
      const timeSrv = this.dependencies.getTimeSrv();
      const runnerArgs = { variable, dataSource, searchFilter, timeSrv };
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

      const request = this.getRequest(variable, args, target);

      runner
        .runRequest(runnerArgs, request)
        .pipe(
          filter(() => {
            // lets check if we started another batch during the execution of the observable. If so we just want to abort the rest.
            const afterUid = this.dependencies.getState().templating.transaction.uid;
            return beforeUid === afterUid;
          }),
          first(data => data.state === LoadingState.Done || data.state === LoadingState.Error),
          this.toMetricFindValues(),
          this.updateOptionsState({ variable, dispatch, getTemplatedRegexFunc }),
          this.runUpdateTagsRequest({ variable, dataSource, searchFilter, timeSrv }),
          this.updateTagsState({ variable, dispatch }),
          filter(() => {
            // If we are searching options there is no need to validate selection state
            // This condition was added to as validateVariableSelectionState will update the current value of the variable
            // So after search and selection the current value is already update so no setValue, refresh & url update is performed
            // The if statement below fixes https://github.com/grafana/grafana/issues/25671
            return !searchFilter;
          }),
          this.validateVariableSelectionState({ variable, dispatch }),
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
            throw new Error("Couldn't find any text column in results.");
          }

          for (const frame of frames) {
            for (let index = 0; index < frame.length; index++) {
              const expandable = expandableIndex ? frame.fields[expandableIndex].values.get(index) : undefined;
              const string = frame.fields[stringIndex].values.get(index);
              const text = textIndex ? frame.fields[textIndex].values.get(index) : null;
              const value = valueIndex ? frame.fields[valueIndex].values.get(index) : null;

              if (!valueIndex && !textIndex) {
                metrics.push({ text: string, value: string, expandable });
                continue;
              }

              if (!valueIndex && textIndex) {
                metrics.push({ text, value: text, expandable });
                continue;
              }

              if (valueIndex && !textIndex) {
                metrics.push({ text: value, value, expandable });
                continue;
              }
            }
          }

          return metrics;
        })
      );
  }

  private updateOptionsState(args: {
    variable: QueryVariableModel;
    dispatch: ThunkDispatch;
    getTemplatedRegexFunc: typeof getTemplatedRegex;
  }): OperatorFunction<MetricFindValue[], void> {
    return source =>
      source.pipe(
        map(results => {
          const { variable, dispatch, getTemplatedRegexFunc } = args;
          const templatedRegex = getTemplatedRegexFunc(variable);
          const payload = toVariablePayload(variable, { results, templatedRegex });
          dispatch(updateVariableOptions(payload));
        })
      );
  }

  private runUpdateTagsRequest(args: {
    variable: QueryVariableModel;
    dataSource: DataSourceApi;
    timeSrv: TimeSrv;
    searchFilter?: string;
  }): OperatorFunction<void, MetricFindValue[]> {
    return source =>
      source.pipe(
        mergeMap(() => {
          const { dataSource, searchFilter, variable, timeSrv } = args;

          if (variable.useTags && dataSource.metricFindQuery) {
            return from(
              dataSource.metricFindQuery(variable.tagsQuery, getLegacyQueryOptions(variable, searchFilter, timeSrv))
            );
          }

          return of([]);
        })
      );
  }

  private updateTagsState(args: {
    variable: QueryVariableModel;
    dispatch: ThunkDispatch;
  }): OperatorFunction<MetricFindValue[], void> {
    return source =>
      source.pipe(
        map(tagResults => {
          const { dispatch, variable } = args;
          dispatch(updateVariableTags(toVariablePayload(variable, tagResults)));
        })
      );
  }

  private validateVariableSelectionState(args: {
    variable: QueryVariableModel;
    dispatch: ThunkDispatch;
  }): OperatorFunction<void, void> {
    return source =>
      source.pipe(
        mergeMap(tagResults => {
          const { dispatch, variable } = args;
          // If we are searching options there is no need to validate selection state
          // This condition was added to as validateVariableSelectionState will update the current value of the variable
          // So after search and selection the current value is already update so no setValue, refresh & url update is performed
          // The if statement below fixes https://github.com/grafana/grafana/issues/25671
          return from(dispatch(validateVariableSelectionState(toVariableIdentifier(variable))));
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

export const variableQueryRunner = new VariableQueryRunner();
