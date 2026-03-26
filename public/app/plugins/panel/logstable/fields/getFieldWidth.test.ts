import { DEFAULT_FIRST_FIELD_WIDTH, ROW_ACTION_BUTTON_WIDTH } from '../constants';

import { getFieldWidth } from './getFieldWidth';

describe('getFieldWidth', () => {
  it('Should return undefined', () => {
    expect(getFieldWidth(undefined, 1, {})).toEqual(undefined);
  });
  it('Should return default width for first field', () => {
    expect(getFieldWidth(undefined, 0, {})).toEqual(200);
  });
  it('Should return width', () => {
    expect(getFieldWidth(300, 0, {})).toEqual(300);
  });
  it('Should not return timestamp field width', () => {
    expect(getFieldWidth(undefined, 1, {})).toEqual(undefined);
  });

  it('Should return timestamp field width', () => {
    expect(getFieldWidth(undefined, 0, {})).toEqual(DEFAULT_FIRST_FIELD_WIDTH);
  });
  it('Should return timestamp field width with padding for copyLogLine', () => {
    expect(getFieldWidth(undefined, 0, { showCopyLogLink: true })).toEqual(
      DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2
    );
  });
  it('Should return timestamp field width with padding for showInspectLogLine', () => {
    expect(getFieldWidth(undefined, 0, { showInspectLogLine: true })).toEqual(
      DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2
    );
  });
  it('Should return timestamp field width with padding for both options', () => {
    expect(
      getFieldWidth(undefined, 0, {
        showInspectLogLine: true,
        showCopyLogLink: true,
      })
    ).toEqual(DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH);
  });
});
