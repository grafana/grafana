import { EventBusSrv, FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';

import { getStandardEditorContext } from './getVisualizationOptions';

describe('getStandardEditorContext', () => {
  it('defaults the series data to an empty array', () => {
    const editorContext = getStandardEditorContext({
      data: undefined,
      replaceVariables: jest.fn(),
      options: {},
      eventBus: new EventBusSrv(),
      instanceState: {},
    });

    expect(editorContext.data).toEqual([]);
  });

  it('returns suggestions for empty data', () => {
    const editorContext = getStandardEditorContext({
      data: undefined,
      replaceVariables: jest.fn(),
      options: {},
      eventBus: new EventBusSrv(),
      instanceState: {},
    });

    expect(editorContext.getSuggestions).toBeDefined();
    expect(editorContext.getSuggestions?.()).toEqual([
      {
        documentation: 'Name of the series',
        label: 'Name',
        origin: 'series',
        value: '__series.name',
      },
      {
        documentation: 'Field name of the clicked datapoint (in ms epoch)',
        label: 'Name',
        origin: 'field',
        value: '__field.name',
      },
      {
        documentation: 'Adds current variables',
        label: 'All variables',
        origin: 'template',
        value: '__all_variables',
      },
      {
        documentation: 'Adds current time range',
        label: 'Time range',
        origin: 'built-in',
        value: '__url_time_range',
      },
      {
        documentation: "Adds current time range's from value",
        label: 'Time range: from',
        origin: 'built-in',
        value: '__from',
      },
      {
        documentation: "Adds current time range's to value",
        label: 'Time range: to',
        origin: 'built-in',
        value: '__to',
      },
    ]);
  });

  it('returns suggestions for non-empty data', () => {
    const series = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'score', type: FieldType.number },
        ],
      }),
    ];

    const panelData = {
      series,
      timeRange: getDefaultTimeRange(),
      state: LoadingState.Done,
    };

    const editorContext = getStandardEditorContext({
      data: panelData,
      replaceVariables: jest.fn(),
      options: {},
      eventBus: new EventBusSrv(),
      instanceState: {},
    });

    expect(editorContext.getSuggestions).toBeDefined();
    expect(editorContext.getSuggestions?.()).toEqual([
      {
        documentation: 'Name of the series',
        label: 'Name',
        origin: 'series',
        value: '__series.name',
      },
      {
        documentation: 'Field name of the clicked datapoint (in ms epoch)',
        label: 'Name',
        origin: 'field',
        value: '__field.name',
      },
      {
        documentation: 'Formatted value for time on the same row',
        label: 'time',
        origin: 'fields',
        value: '__data.fields.time',
      },
      {
        documentation: 'Formatted value for score on the same row',
        label: 'score',
        origin: 'fields',
        value: '__data.fields.score',
      },
      {
        documentation: 'Enter the field order',
        label: 'Select by index',
        origin: 'fields',
        value: '__data.fields[0]',
      },
      {
        documentation: 'the numeric field value',
        label: 'Show numeric value',
        origin: 'fields',
        value: '__data.fields.score.numeric',
      },
      {
        documentation: 'the text value',
        label: 'Show text value',
        origin: 'fields',
        value: '__data.fields.score.text',
      },
      {
        documentation: 'Adds current variables',
        label: 'All variables',
        origin: 'template',
        value: '__all_variables',
      },
      {
        documentation: 'Adds current time range',
        label: 'Time range',
        origin: 'built-in',
        value: '__url_time_range',
      },
      {
        documentation: "Adds current time range's from value",
        label: 'Time range: from',
        origin: 'built-in',
        value: '__from',
      },
      {
        documentation: "Adds current time range's to value",
        label: 'Time range: to',
        origin: 'built-in',
        value: '__to',
      },
    ]);
  });
});
