import { isNull } from './binaryOperators';


describe('Test addition', () => {
    it('Should add two numbers', () => {
        const a = 1;
        const b = null;
        const result = isNull(a, b);
        expect(result).toBe(true);
    });
});
