/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { email } from './email';
describe('validators :: email', () => {
    // NOTE: some of these tests were taken from Chromium's source code
    test('email validator should return undefined if the passed email is valid', () => {
        expect(email('test@example.org')).toBeUndefined();
        expect(email('someone@127.0.0.1')).toBeUndefined();
        expect(email("!#$%&'*+/=?^_`{|}~.-@com.com")).toBeUndefined();
        expect(email('te..st@example.com')).toBeUndefined();
    });
    test('email validator should return an error string if the passed email is invalid', () => {
        expect(email('test')).toEqual('Invalid email address');
        expect(email('invalid:email@example.com')).toEqual('Invalid email address');
        expect(email('someone@somewhere.com.')).toEqual('Invalid email address');
        expect(email('""test\blah""@example.com')).toEqual('Invalid email address');
        expect(email('a\u3000@p.com')).toEqual('Invalid email address');
        expect(email('ddjk-s-jk@asl-.com')).toEqual('Invalid email address');
        expect(email('a @p.com')).toEqual('Invalid email address');
        expect(email('')).toEqual('Invalid email address');
        // NOTE: the following is an exception, we don't consider valid
        //       email addresses with no TLD
        expect(email('test@example')).toEqual('Invalid email address');
    });
    test('the validator should not check for empty/undefined values', () => {
        expect(email(undefined)).toBeUndefined();
    });
});
//# sourceMappingURL=email.test.js.map