/* type a mocked function as jest mock, example:
 * import { doFoo } from 'foo';
 *
 * jest.mock('foo');
 *
 * const doFooMock = typeAsJestMock(doFoo); // doFooMock is of type jest.Mock with proper return type for doFoo
 */
export var typeAsJestMock = function (fn) { return fn; };
//# sourceMappingURL=typeAsJestMock.js.map