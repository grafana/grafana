import { Field, FieldType } from '@grafana/data';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';

import { DEFAULT_FIRST_FIELD_WIDTH, ROW_ACTION_BUTTON_WIDTH } from '../constants';

import { getFieldWidth } from './getFieldWidth';

const timeField: Field = { config: {}, name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] };
const bodyField: Field = {
  config: {},
  name: LOGS_DATAPLANE_BODY_NAME,
  type: FieldType.string,
  values: ['log 1', 'log 2'],
};

describe('getFieldWidth', () => {
  it('Should return undefined if first field is not time', () => {
    expect(getFieldWidth(undefined, bodyField, 0, LOGS_DATAPLANE_TIMESTAMP_NAME, {})).toEqual(undefined);
  });
  it('Should return width', () => {
    expect(getFieldWidth(200, bodyField, 0, LOGS_DATAPLANE_TIMESTAMP_NAME, {})).toEqual(200);
  });
  it('Should not return timestamp field width', () => {
    expect(getFieldWidth(undefined, timeField, 1, LOGS_DATAPLANE_TIMESTAMP_NAME, {})).toEqual(undefined);
  });

  it('Should return timestamp field width', () => {
    expect(getFieldWidth(undefined, timeField, 0, LOGS_DATAPLANE_TIMESTAMP_NAME, {})).toEqual(
      DEFAULT_FIRST_FIELD_WIDTH
    );
  });
  it('Should return timestamp field width with padding for copyLogLine', () => {
    expect(getFieldWidth(undefined, timeField, 0, LOGS_DATAPLANE_TIMESTAMP_NAME, { showCopyLogLink: true })).toEqual(
      DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2
    );
  });
  it('Should return timestamp field width with padding for showInspectLogLine', () => {
    expect(getFieldWidth(undefined, timeField, 0, LOGS_DATAPLANE_TIMESTAMP_NAME, { showInspectLogLine: true })).toEqual(
      DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2
    );
  });
  it('Should return timestamp field width with padding for both options', () => {
    expect(
      getFieldWidth(undefined, timeField, 0, LOGS_DATAPLANE_TIMESTAMP_NAME, {
        showInspectLogLine: true,
        showCopyLogLink: true,
      })
    ).toEqual(DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH);
  });
});
