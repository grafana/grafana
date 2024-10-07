import { isEmpty } from 'lodash';
import { Observable, scan } from 'rxjs';

import { createDataFrame, CustomTransformOperator, DataFrame, PartialDataFrame } from '@grafana/data';

import { LogFilter } from './LogViewFilters';

export function createFilterTransformation(filter: LogFilter): CustomTransformOperator {
  return function cascadingFilterTransformation() {
    return function (source: Observable<DataFrame[]>) {
      return source.pipe(
        scan((filtered: DataFrame[], current) => {
          if (isEmpty(filter.extensionPointIds) && isEmpty(filter.pluginIds) && isEmpty(filter.severity)) {
            return current;
          }

          for (const frame of current) {
            const pluginIdIndex = frame.fields.findIndex((f) => f.name === 'pluginId');
            const extensionPointIdIndex = frame.fields.findIndex((f) => f.name === 'extensionPointId');
            const severityIndex = frame.fields.findIndex((f) => f.name === 'severity');

            if (pluginIdIndex === -1 && !isEmpty(filter.pluginIds)) {
              continue;
            }

            if (extensionPointIdIndex === -1 && !isEmpty(filter.extensionPointIds)) {
              continue;
            }

            if (severityIndex === -1 && !isEmpty(filter.severity)) {
              continue;
            }

            const target: PartialDataFrame = {
              ...frame,
              fields: frame.fields.map((f) => ({
                ...f,
                values: [],
              })),
            };

            for (let index = 0; index < frame.length; index++) {
              const pluginId = frame.fields[pluginIdIndex].values[index];
              const extensionPointId = frame.fields[extensionPointIdIndex].values[index];
              const severity = frame.fields[severityIndex].values[index];

              if (!isEmpty(filter.pluginIds) && !filter.pluginIds?.has(pluginId)) {
                continue;
              }

              if (!isEmpty(filter.extensionPointIds) && !filter.extensionPointIds?.has(extensionPointId)) {
                continue;
              }

              if (!isEmpty(filter.severity) && !filter.severity?.has(severity)) {
                continue;
              }

              copyRow(frame, target, index);
            }

            filtered.push(createDataFrame(target));
          }

          return filtered;
        }, [])
      );
    };
  };
}

function copyRow(source: DataFrame, target: PartialDataFrame, rowIndex: number) {
  for (let index = 0; index < source.fields.length; index++) {
    const field = source.fields[index];

    if (!target.fields[index]) {
      target.fields[index] = {
        ...field,
        values: [],
      };
    }

    const value = source.fields[index].values[rowIndex];
    target.fields[index].values?.push(value);
  }
}
