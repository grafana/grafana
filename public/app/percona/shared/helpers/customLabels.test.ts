import { CustomLabelsUtils } from './customLabels';

describe('CustomLabelsUtils', () => {
  it('converts to payload', () => {
    const input = 'labelOne:1\nlabelTwo:2\nlabelThree:value';

    expect(CustomLabelsUtils.toPayload(input)).toEqual({
      labelOne: '1',
      labelTwo: '2',
      labelThree: 'value',
    });
  });

  it('converts from payload', () => {
    const payload = {
      labelOne: '1',
      labelTwo: '2',
      labelThree: 'value',
    };

    expect(CustomLabelsUtils.fromPayload(payload)).toBe('labelOne:1\nlabelTwo:2\nlabelThree:value');
  });
});
