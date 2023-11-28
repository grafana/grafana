import { compose } from './compose';
describe('validators :: compose', () => {
    it('returns the first error message', () => {
        let validate = compose([jest.fn().mockReturnValue('test'), jest.fn().mockReturnValue('ignored')]);
        expect(validate(undefined, {})).toEqual('test');
        validate = compose([jest.fn(), jest.fn().mockReturnValue('test 2')]);
        expect(validate(undefined, {})).toEqual('test 2');
    });
});
//# sourceMappingURL=compose.test.js.map