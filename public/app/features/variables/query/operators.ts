import { from, of, OperatorFunction } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { QueryVariableModel } from '../types';
import { ThunkDispatch } from '../../../types';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { validateVariableSelectionState } from '../state/actions';
import { DataSourceApi, FieldType, getFieldDisplayName, MetricFindValue, PanelData } from '@grafana/data';
import { updateVariableOptions, updateVariableTags } from './reducer';
import { getTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { getLegacyQueryOptions, getTemplatedRegex } from '../utils';

const metricFindValueProps = ['text', 'Text', 'value', 'Value'];

export function toMetricFindValues(): OperatorFunction<PanelData, MetricFindValue[]> {
  return (source) =>
    source.pipe(
      map((panelData) => {
        const frames = panelData.series;
        if (!frames || !frames.length) {
          return [];
        }

        if (areMetricFindValues(frames)) {
          return frames;
        }

        const metrics: MetricFindValue[] = [];

        let valueIndex = -1;
        let textIndex = -1;
        let stringIndex = -1;
        let expandableIndex = -1;

        for (const frame of frames) {
          for (let index = 0; index < frame.fields.length; index++) {
            const field = frame.fields[index];
            const fieldName = getFieldDisplayName(field, frame, frames).toLowerCase();

            if (field.type === FieldType.string && stringIndex === -1) {
              stringIndex = index;
            }

            if (fieldName === 'text' && field.type === FieldType.string && textIndex === -1) {
              textIndex = index;
            }

            if (fieldName === 'value' && field.type === FieldType.string && valueIndex === -1) {
              valueIndex = index;
            }

            if (
              fieldName === 'expandable' &&
              (field.type === FieldType.boolean || field.type === FieldType.number) &&
              expandableIndex === -1
            ) {
              expandableIndex = index;
            }
          }
        }

        if (stringIndex === -1) {
          throw new Error("Couldn't find any field of type string in the results.");
        }

        for (const frame of frames) {
          for (let index = 0; index < frame.length; index++) {
            const expandable = expandableIndex !== -1 ? frame.fields[expandableIndex].values.get(index) : undefined;
            const string = frame.fields[stringIndex].values.get(index);
            const text = textIndex !== -1 ? frame.fields[textIndex].values.get(index) : null;
            const value = valueIndex !== -1 ? frame.fields[valueIndex].values.get(index) : null;

            if (valueIndex === -1 && textIndex === -1) {
              metrics.push({ text: string, value: string, expandable });
              continue;
            }

            if (valueIndex === -1 && textIndex !== -1) {
              metrics.push({ text, value: text, expandable });
              continue;
            }

            if (valueIndex !== -1 && textIndex === -1) {
              metrics.push({ text: value, value, expandable });
              continue;
            }

            metrics.push({ text, value, expandable });
          }
        }

        return metrics;
      })
    );
}

export function updateOptionsState(args: {
  variable: QueryVariableModel;
  dispatch: ThunkDispatch;
  getTemplatedRegexFunc: typeof getTemplatedRegex;
}): OperatorFunction<MetricFindValue[], void> {
  return (source) =>
    source.pipe(
      map((results) => {
        const { variable, dispatch, getTemplatedRegexFunc } = args;
        const templatedRegex = getTemplatedRegexFunc(variable);
        const payload = toVariablePayload(variable, { results, templatedRegex });
        dispatch(updateVariableOptions(payload));
      })
    );
}

export function runUpdateTagsRequest(
  args: {
    variable: QueryVariableModel;
    datasource: DataSourceApi;
    searchFilter?: string;
  },
  timeSrv: TimeSrv = getTimeSrv()
): OperatorFunction<void, MetricFindValue[]> {
  return (source) =>
    source.pipe(
      mergeMap(() => {
        const { datasource, searchFilter, variable } = args;

        if (variable.useTags && datasource.metricFindQuery) {
          return from(
            datasource.metricFindQuery(variable.tagsQuery, getLegacyQueryOptions(variable, searchFilter, timeSrv))
          );
        }

        return of([]);
      })
    );
}

export function updateTagsState(args: {
  variable: QueryVariableModel;
  dispatch: ThunkDispatch;
}): OperatorFunction<MetricFindValue[], void> {
  return (source) =>
    source.pipe(
      map((tagResults) => {
        const { dispatch, variable } = args;

        if (variable.useTags) {
          dispatch(updateVariableTags(toVariablePayload(variable, tagResults)));
        }
      })
    );
}

export function validateVariableSelection(args: {
  variable: QueryVariableModel;
  dispatch: ThunkDispatch;
  searchFilter?: string;
}): OperatorFunction<void, void> {
  return (source) =>
    source.pipe(
      mergeMap(() => {
        const { dispatch, variable, searchFilter } = args;

        // If we are searching options there is no need to validate selection state
        // This condition was added to as validateVariableSelectionState will update the current value of the variable
        // So after search and selection the current value is already update so no setValue, refresh & url update is performed
        // The if statement below fixes https://github.com/grafana/grafana/issues/25671
        if (!searchFilter) {
          return from(dispatch(validateVariableSelectionState(toVariableIdentifier(variable))));
        }

        return of<void>();
      })
    );
}

export function areMetricFindValues(data: any[]): data is MetricFindValue[] {
  if (!data) {
    return false;
  }

  if (!data.length) {
    return true;
  }

  const firstValue: any = data[0];
  return metricFindValueProps.some((prop) => firstValue.hasOwnProperty(prop) && typeof firstValue[prop] === 'string');
}
