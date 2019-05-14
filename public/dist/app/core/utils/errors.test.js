import { getMessageFromError } from 'app/core/utils/errors';
describe('errors functions', function () {
    var message;
    describe('when getMessageFromError gets an error string', function () {
        beforeEach(function () {
            message = getMessageFromError('error string');
        });
        it('should return the string', function () {
            expect(message).toBe('error string');
        });
    });
    describe('when getMessageFromError gets an error object with message field', function () {
        beforeEach(function () {
            message = getMessageFromError({ message: 'error string' });
        });
        it('should return the message text', function () {
            expect(message).toBe('error string');
        });
    });
    describe('when getMessageFromError gets an error object with data.message field', function () {
        beforeEach(function () {
            message = getMessageFromError({ data: { message: 'error string' } });
        });
        it('should return the message text', function () {
            expect(message).toBe('error string');
        });
    });
    describe('when getMessageFromError gets an error object with statusText field', function () {
        beforeEach(function () {
            message = getMessageFromError({ statusText: 'error string' });
        });
        it('should return the statusText text', function () {
            expect(message).toBe('error string');
        });
    });
    describe('when getMessageFromError gets an error object', function () {
        beforeEach(function () {
            message = getMessageFromError({ customError: 'error string' });
        });
        it('should return the stringified error', function () {
            expect(message).toBe('{"customError":"error string"}');
        });
    });
});
//# sourceMappingURL=errors.test.js.map