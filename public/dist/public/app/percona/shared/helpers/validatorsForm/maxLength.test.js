import { maxLength } from './maxLength';
describe('Validator maxLength::', () => {
    it('should return undefined if the string length is equal to or less than maxLength parameter value', () => {
        const validator = maxLength(8);
        expect(validator('12345678')).toBeUndefined();
        expect(validator('0Yz56W')).toBeUndefined();
    });
    it('should return an error if the string length is greater than maxLength parameter value', () => {
        const length = 8;
        const validator = maxLength(length);
        const errorMessage = `Must contain at most ${length} characters`;
        expect(validator('123456789')).toEqual(errorMessage);
    });
    it('should return undefined if the passed value undefined', () => {
        const validator = maxLength(8);
        expect(validator(undefined)).toBeUndefined();
    });
});
//# sourceMappingURL=maxLength.test.js.map