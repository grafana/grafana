/* type a mocked function as jest mock, example:
 * import { doFoo } from 'foo';
 *
 * jest.mock('foo');
 *
 * const doFooMock = typeAsJestMock(doFoo); // doFooMock is of type jest.Mock with proper return type for doFoo
 */

export const typeAsJestMock = <T extends (...args: any) => any>(fn: T) => (fn as unknown) as jest.Mock<ReturnType<T>>;
