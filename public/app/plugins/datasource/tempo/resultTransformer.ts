import { DataQueryResponse, ArrayVector, DataFrame, Field, FieldType, MutableDataFrame } from '@grafana/data';
import { createGraphFrames } from './graphTransform';

export function createTableFrame(
  logsFrame: DataFrame,
  datasourceUid: string,
  datasourceName: string,
  traceRegexs: string[]
): DataFrame {
  const tableFrame = new MutableDataFrame({
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {
          custom: {
            width: 150,
          },
        },
      },
      {
        name: 'traceID',
        type: FieldType.string,
        config: {
          displayNameFromDS: 'Trace ID',
          custom: { width: 300 },
          links: [
            {
              title: 'Click to open trace ${__value.raw}',
              url: '',
              internal: {
                datasourceUid,
                datasourceName,
                query: {
                  query: '${__value.raw}',
                },
              },
            },
          ],
        },
      },
      {
        name: 'Message',
        type: FieldType.string,
      },
    ],
    meta: {
      preferredVisualisationType: 'table',
    },
  });

  if (!logsFrame || traceRegexs.length === 0) {
    return tableFrame;
  }

  const timeField = logsFrame.fields.find((f) => f.type === FieldType.time);

  // Going through all string fields to look for trace IDs
  for (let field of logsFrame.fields) {
    let hasMatch = false;
    if (field.type === FieldType.string) {
      const values = field.values.toArray();
      for (let i = 0; i < values.length; i++) {
        const line = values[i];
        if (line) {
          for (let traceRegex of traceRegexs) {
            const match = (line as string).match(traceRegex);
            if (match) {
              const traceId = match[1];
              const time = timeField ? timeField.values.get(i) : null;
              tableFrame.fields[0].values.add(time);
              tableFrame.fields[1].values.add(traceId);
              tableFrame.fields[2].values.add(line);
              hasMatch = true;
            }
          }
        }
      }
    }
    if (hasMatch) {
      break;
    }
  }

  return tableFrame;
}

export function transformTraceList(
  response: DataQueryResponse,
  datasourceId: string,
  datasourceName: string,
  traceRegexs: string[]
): DataQueryResponse {
  response.data.forEach((data, index) => {
    const frame = createTableFrame(data, datasourceId, datasourceName, traceRegexs);
    response.data[index] = frame;
  });
  return response;
}

export function transformTrace(response: DataQueryResponse): DataQueryResponse {
  // We need to parse some of the fields which contain stringified json.
  // Seems like we can't just map the values as the frame we got from backend has some default processing
  // and will stringify the json back when we try to set it. So we create a new field and swap it instead.
  const frame: DataFrame = response.data[0];

  if (!frame) {
    return emptyDataQueryResponse;
  }

  parseJsonFields(frame);

  return {
    ...response,
    data: [...response.data, ...createGraphFrames(frame)],
  };
}

/**
 * Change fields which are json string into JS objects. Modifies the frame in place.
 */
function parseJsonFields(frame: DataFrame) {
  for (const fieldName of ['serviceTags', 'logs', 'tags']) {
    const field = frame.fields.find((f) => f.name === fieldName);
    if (field) {
      const fieldIndex = frame.fields.indexOf(field);
      const values = new ArrayVector();
      const newField: Field = {
        ...field,
        values,
        type: FieldType.other,
      };

      for (let i = 0; i < field.values.length; i++) {
        const value = field.values.get(i);
        values.set(i, value === '' ? undefined : JSON.parse(value));
      }
      frame.fields[fieldIndex] = newField;
    }
  }
}

const emptyDataQueryResponse = {
  data: [
    new MutableDataFrame({
      fields: [
        {
          name: 'trace',
          type: FieldType.trace,
          values: [],
        },
      ],
      meta: {
        preferredVisualisationType: 'trace',
      },
    }),
  ],
};
