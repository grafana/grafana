import { DataFrame, FieldType, MutableDataFrame } from '@grafana/data';

import { mapDataFrameToAlertPreview } from './preview';

describe('mapDataFrameToAlertPreview', () => {
  it('should convert data frame fields into set of labels, state and info', () => {
    const frame: DataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'severity',
          type: FieldType.string,
          values: ['error', 'error', 'warning', 'warning'],
        },
        {
          name: 'node',
          type: FieldType.string,
          values: ['cpu-0', 'cpu-1', 'cpu-0', 'cpu-1'],
        },
        {
          name: 'State',
          type: FieldType.string,
          values: ['Alerting', 'Alerting', 'Alerting', 'Alerting'],
        },
        {
          name: 'Info',
          type: FieldType.string,
          values: ['value=0.34', 'value=0.2', 'value=0.1', 'value=0.66'],
        },
      ],
    });

    const alertPreview = mapDataFrameToAlertPreview(frame);

    expect(alertPreview.instances).toHaveLength(4);
    expect(alertPreview.instances[0]).toEqual({
      state: 'Alerting',
      info: 'value=0.34',
      labels: { severity: 'error', node: 'cpu-0' },
    });
    expect(alertPreview.instances[1]).toEqual({
      state: 'Alerting',
      info: 'value=0.2',
      labels: { severity: 'error', node: 'cpu-1' },
    });
    expect(alertPreview.instances[2]).toEqual({
      state: 'Alerting',
      info: 'value=0.1',
      labels: { severity: 'warning', node: 'cpu-0' },
    });
    expect(alertPreview.instances[3]).toEqual({
      state: 'Alerting',
      info: 'value=0.66',
      labels: { severity: 'warning', node: 'cpu-1' },
    });
  });

  it('should return 0 instances if there is no State field', () => {
    const frame: DataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'severity',
          type: FieldType.string,
          values: ['error', 'warning'],
        },
        {
          name: 'Info',
          type: FieldType.string,
          values: ['value=0.34', 'value=0.2'],
        },
      ],
    });

    const alertPreview = mapDataFrameToAlertPreview(frame);

    expect(alertPreview.instances).toHaveLength(0);
  });

  it('should return instances with labels if there is no Info field', () => {
    const frame: DataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'severity',
          type: FieldType.string,
          values: ['error', 'warning'],
        },
        {
          name: 'State',
          type: FieldType.string,
          values: ['Alerting', 'Alerting'],
        },
      ],
    });

    const alertPreview = mapDataFrameToAlertPreview(frame);

    expect(alertPreview.instances).toHaveLength(2);
    expect(alertPreview.instances[0]).toEqual({
      state: 'Alerting',
      labels: { severity: 'error' },
    });
    expect(alertPreview.instances[1]).toEqual({
      state: 'Alerting',
      labels: { severity: 'warning' },
    });
  });

  it('should limit number of instances to number of State values', () => {
    const frame: DataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'severity',
          type: FieldType.string,
          values: ['critical', 'error', 'warning', 'info'],
        },
        {
          name: 'State',
          type: FieldType.string,
          values: ['Alerting', 'Alerting'],
        },
      ],
    });

    const alertPreview = mapDataFrameToAlertPreview(frame);

    expect(alertPreview.instances).toHaveLength(2);
    expect(alertPreview.instances[0]).toEqual({ state: 'Alerting', labels: { severity: 'critical' } });
    expect(alertPreview.instances[1]).toEqual({ state: 'Alerting', labels: { severity: 'error' } });
  });

  // Just to be resistant to incomplete data in data frames
  it('should return instances with labels if number of fields values do not match', () => {
    const frame: DataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'severity',
          type: FieldType.string,
          values: ['error', 'error', 'warning', 'warning'],
        },
        {
          name: 'node',
          type: FieldType.string,
          values: ['cpu-0', 'cpu-1', 'cpu-1'],
        },
        {
          name: 'State',
          type: FieldType.string,
          values: ['Alerting', 'Alerting', 'Alerting', 'Alerting'],
        },
        {
          name: 'Info',
          type: FieldType.string,
          values: ['value=0.34', 'value=0.2', 'value=0.66'],
        },
      ],
    });

    const alertPreview = mapDataFrameToAlertPreview(frame);

    expect(alertPreview.instances).toHaveLength(4);
    expect(alertPreview.instances[0]).toEqual({
      state: 'Alerting',
      info: 'value=0.34',
      labels: { severity: 'error', node: 'cpu-0' },
    });
    expect(alertPreview.instances[1]).toEqual({
      state: 'Alerting',
      info: 'value=0.2',
      labels: { severity: 'error', node: 'cpu-1' },
    });
    expect(alertPreview.instances[2]).toEqual({
      state: 'Alerting',
      info: 'value=0.66',
      labels: { severity: 'warning', node: 'cpu-1' },
    });
    expect(alertPreview.instances[3]).toEqual({
      state: 'Alerting',
      info: undefined,
      labels: { severity: 'warning', node: undefined },
    });
  });
});
