import { DEFAULT_TIME_FIELD_WIDTH, ROW_ACTION_BUTTON_WIDTH } from '../constants';

import { getTimeFieldWidth } from './getFieldWidth';

describe('getTimeFieldWidth', () => {
  it('Should return undefined', () => {
    expect(getTimeFieldWidth(undefined, 1, {})).toEqual(undefined);
  });
  it('Should return default width for first field', () => {
    expect(getTimeFieldWidth(undefined, 0, {})).toEqual(200);
  });
  it('Should return width', () => {
    expect(getTimeFieldWidth(300, 0, {})).toEqual(300);
  });
  it('Should not return timestamp field width', () => {
    expect(getTimeFieldWidth(undefined, 1, {})).toEqual(undefined);
  });

  it('Should return timestamp field width', () => {
    expect(getTimeFieldWidth(undefined, 0, {})).toEqual(DEFAULT_TIME_FIELD_WIDTH);
  });
  it('Should return timestamp field width with padding for copyLogLine', () => {
    expect(getTimeFieldWidth(undefined, 0, { showCopyLogLink: true })).toEqual(
      DEFAULT_TIME_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2
    );
  });
  it('Should return timestamp field width with padding for enableLogDetails', () => {
    expect(getTimeFieldWidth(undefined, 0, { enableLogDetails: true })).toEqual(
      DEFAULT_TIME_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2
    );
  });
  it('Should return timestamp field width with padding for both options', () => {
    expect(
      getTimeFieldWidth(undefined, 0, {
        enableLogDetails: true,
        showCopyLogLink: true,
      })
    ).toEqual(DEFAULT_TIME_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH);
  });
});
