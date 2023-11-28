/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { greaterThan } from './greaterThan';
describe('Validators:: greaterThen', () => {
    const errorMessage = 'Must be a number greater than 100';
    const greaterThenValidator = greaterThan(100);
    it('should return undefined if the input contains a value which is greater than 100', () => {
        expect(greaterThenValidator('101')).toEqual(undefined);
        expect(greaterThenValidator('987.5')).toEqual(undefined);
        expect(greaterThenValidator('1000')).toEqual(undefined);
    });
    it('should return an error if the input is not a number or contains a value which is less than 100', () => {
        expect(greaterThenValidator('-1')).toEqual(errorMessage);
        expect(greaterThenValidator('0')).toEqual(errorMessage);
        expect(greaterThenValidator(true)).toEqual(errorMessage);
        expect(greaterThenValidator(null)).toEqual(errorMessage);
        expect(greaterThenValidator(undefined)).toEqual(errorMessage);
        expect(greaterThenValidator('string')).toEqual(errorMessage);
        expect(greaterThenValidator({})).toEqual(errorMessage);
        expect(greaterThenValidator([])).toEqual(errorMessage);
    });
});
//# sourceMappingURL=greaterThan.test.js.map