import { toDataFrame } from '../dataframe/processDataFrame';

import { decoupleHideFromState } from './decoupleHideFromState';

describe('decoupleHideFromState', () => {
  it('should not throw an error for fields with no "custom" in config', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Field 1', config: {} }],
    });

    expect(frame.fields[0].state?.hideFrom).toBeUndefined();

    decoupleHideFromState([frame], {
      defaults: {},
      overrides: [],
    });

    expect(frame.fields[0].state?.hideFrom).not.toBeUndefined();
  });
});
