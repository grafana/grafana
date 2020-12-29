import {
  ByNamesMatcherMode,
  DataFrame,
  FieldConfigSource,
  FieldMatcherID,
  FieldType,
  toDataFrame,
} from '@grafana/data';
import { GraphNGLegendEvent, GraphNGLegendEventMode } from '@grafana/ui';
import { hideSeriesConfigFactory } from './hideSeriesConfigFactory';

describe('hideSeriesConfigFactory', () => {
  it('should create config override matching one series', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.ToggleSelection,
      fieldIndex: {
        frameIndex: 0,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride(['temperature'])],
    });
  });

  it('should create config override matching one series if selected with others', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.ToggleSelection,
      fieldIndex: {
        frameIndex: 0,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature', 'humidity'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'pressure', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride(['temperature'])],
    });
  });

  it('should create config override that append series to existing override', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.AppendToSelection,
      fieldIndex: {
        frameIndex: 1,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'pressure', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride(['temperature', 'humidity'])],
    });
  });

  it('should create config override that hides all series if appending only existing series', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.AppendToSelection,
      fieldIndex: {
        frameIndex: 0,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride([])],
    });
  });

  it('should create config override that removes series if appending existing field', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.AppendToSelection,
      fieldIndex: {
        frameIndex: 0,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature', 'humidity'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride(['humidity'])],
    });
  });

  it('should create config override replacing existing series', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.ToggleSelection,
      fieldIndex: {
        frameIndex: 1,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride(['humidity'])],
    });
  });

  it('should create config override removing existing series', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.ToggleSelection,
      fieldIndex: {
        frameIndex: 0,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [],
    });
  });

  it('should remove override if all fields are appended', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.AppendToSelection,
      fieldIndex: {
        frameIndex: 1,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [],
    });
  });

  it('should create config override hiding appended series if no previous override exists', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.AppendToSelection,
      fieldIndex: {
        frameIndex: 0,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'pressure', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride(['humidity', 'pressure'])],
    });
  });

  it('should return existing override if invalid index is passed', () => {
    const event: GraphNGLegendEvent = {
      mode: GraphNGLegendEventMode.ToggleSelection,
      fieldIndex: {
        frameIndex: 4,
        fieldIndex: 1,
      },
    };

    const existingConfig: FieldConfigSource = {
      defaults: {},
      overrides: [createOverride(['temperature'])],
    };

    const data: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
          { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
        ],
      }),
    ];

    const config = hideSeriesConfigFactory(event, existingConfig, data);

    expect(config).toEqual({
      defaults: {},
      overrides: [createOverride(['temperature'])],
    });
  });
});

const createOverride = (matchers: string[]) => {
  return {
    __systemRef: 'hideSeriesFrom',
    matcher: {
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.exclude,
        names: matchers,
        prefix: 'All except:',
        readOnly: true,
      },
    },
    properties: [
      {
        id: 'custom.hideFrom',
        value: {
          graph: true,
          legend: false,
          tooltip: false,
        },
      },
    ],
  };
};
