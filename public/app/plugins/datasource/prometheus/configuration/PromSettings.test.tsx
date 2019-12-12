import { getValueFromEventItem } from './PromSettings';

describe('PromSettings', () => {
  describe('getValueFromEventItem', () => {
    describe('when called with undefined', () => {
      it('then it should return empty string', () => {
        const result = getValueFromEventItem(undefined);
        expect(result).toEqual('');
      });
    });

    describe('when called with an input event', () => {
      it('then it should return value from currentTarget', () => {
        const value = 'An input value';
        const result = getValueFromEventItem({ currentTarget: { value } });
        expect(result).toEqual(value);
      });
    });

    describe('when called with a select event', () => {
      it('then it should return value', () => {
        const value = 'A select value';
        const result = getValueFromEventItem({ value });
        expect(result).toEqual(value);
      });
    });
  });
});
