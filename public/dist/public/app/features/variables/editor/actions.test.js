import { constantBuilder, customBuilder } from '../shared/testing/builders';
import { getNextAvailableId } from './actions';
describe('getNextAvailableId', function () {
    describe('when called with a custom type and there is already 2 variables', function () {
        it('then the correct id should be created', function () {
            var custom1 = customBuilder().withId('custom0').withName('custom0').build();
            var constant1 = constantBuilder().withId('custom1').withName('custom1').build();
            var variables = [custom1, constant1];
            var type = 'custom';
            var result = getNextAvailableId(type, variables);
            expect(result).toEqual('custom2');
        });
    });
});
//# sourceMappingURL=actions.test.js.map