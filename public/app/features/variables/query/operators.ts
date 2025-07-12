import { from, of, OperatorFunction } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import {
  FieldType,
  getFieldDisplayName,
  getProcessedDataFrames,
  isDataFrame,
  MetricFindValue,
  PanelData,
  QueryVariableModel,
} from '@grafana/data';
import { ThunkDispatch } from 'app/types/store';

import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getTemplatedRegex, toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { updateVariableOptions } from './reducer';

export function toMetricFindValuesOperator(): OperatorFunction<PanelData, MetricFindValue[]> {
  return (source) => source.pipe(map(toMetricFindValues));
}

export function toMetricFindValues(panelData: PanelData): MetricFindValue[] {
  const frames = panelData.series;
  if (!frames || !frames.length) {
    return [];
  }

  if (areMetricFindValues(frames)) {
    return frames;
  }

  const processedDataFrames = getProcessedDataFrames(frames);
  const metrics: MetricFindValue[] = [];

  let valueIndex = -1;
  let textIndex = -1;
  let stringIndex = -1;
  let expandableIndex = -1;

  for (const frame of processedDataFrames) {
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

  for (const frame of processedDataFrames) {
    for (let index = 0; index < frame.length; index++) {
      const expandable = expandableIndex !== -1 ? frame.fields[expandableIndex].values[index] : undefined;
      const string = frame.fields[stringIndex].values[index];
      const text = textIndex !== -1 ? frame.fields[textIndex].values[index] : null;
      const value = valueIndex !== -1 ? frame.fields[valueIndex].values[index] : null;

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
        if (!variable.rootStateKey) {
          console.error('updateOptionsState: variable.rootStateKey is not defined');
          return;
        }
        const templatedRegex = getTemplatedRegexFunc(variable);
        const payload = toVariablePayload(variable, { results, templatedRegex });
        dispatch(toKeyedAction(variable.rootStateKey, updateVariableOptions(payload)));
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
        // So after search and selection the current value is already update so no setValue, refresh and URL update is performed
        // The if statement below fixes https://github.com/grafana/grafana/issues/25671
        if (!searchFilter) {
          return from(dispatch(validateVariableSelectionState(toKeyedVariableIdentifier(variable))));
        }

        return of<void>();
      })
    );
}

export function areMetricFindValues(data: unknown[]): data is MetricFindValue[] {
  if (!data) {
    return false;
  }

  if (!data.length) {
    return true;
  }

  const firstValue: any = data[0];

  if (isDataFrame(firstValue)) {
    return false;
  }

  for (const firstValueKey in firstValue) {
    if (!firstValue.hasOwnProperty(firstValueKey)) {
      continue;
    }

    if (
      firstValue[firstValueKey] !== null &&
      typeof firstValue[firstValueKey] !== 'string' &&
      typeof firstValue[firstValueKey] !== 'number'
    ) {
      continue;
    }

    const key = firstValueKey.toLowerCase();

    if (key === 'text' || key === 'value') {
      return true;
    }
  }

  return false;
}
