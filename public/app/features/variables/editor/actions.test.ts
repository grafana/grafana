import { constantBuilder, customBuilder } from '../shared/testing/builders';
import { getNextAvailableId } from './actions';

describe('getNextAvailableId', () => {
  describe('when called with a custom type and there is already 2 variables', () => {
    it('then the correct id should be created', () => {
      const custom1 = customBuilder().withId('custom0').withName('custom0').build();
      const constant1 = constantBuilder().withId('custom1').withName('custom1').build();
      const variables = [custom1, constant1];
      const type = 'custom';

      const result = getNextAvailableId(type, variables);

      expect(result).toEqual('custom2');
    });
  });
});
