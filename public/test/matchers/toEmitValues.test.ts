import { interval, Observable, of, throwError } from 'rxjs';
import { map, mergeMap, take } from 'rxjs/operators';
import { OBSERVABLE_TEST_TIMEOUT_IN_MS } from './types';

describe('toEmitValues matcher', () => {
  describe('failing tests', () => {
    describe('passing null in expect', () => {
      it('should fail with correct message', async () => {
        const observable = (null as unknown) as Observable<number>;

        const rejects = expect(() => expect(observable).toEmitValues([1, 2, 3])).rejects;
        await rejects.toThrow();
        await rejects.toMatchInlineSnapshot(`
          [Error: [2mexpect([22m[31mreceived[39m[2m).toEmitValues([22m[32mexpected[39m[2m)[22m

          Expected [31mnull[39m to be [32m"defined"[39m.]
        `);
      });
    });

    describe('passing undefined in expect', () => {
      it('should fail with correct message', async () => {
        const observable = (undefined as unknown) as Observable<number>;

        const rejects = expect(() => expect(observable).toEmitValues([1, 2, 3])).rejects;
        await rejects.toThrow();
        await rejects.toMatchInlineSnapshot(`
          [Error: [2mexpect([22m[31mreceived[39m[2m).toEmitValues([22m[32mexpected[39m[2m)[22m

          Expected [31mundefined[39m to be [32m"defined"[39m.]
        `);
      });
    });

    describe('passing number instead of Observable in expect', () => {
      it('should fail with correct message', async () => {
        const observable = (1 as unknown) as Observable<number>;

        const rejects = expect(() => expect(observable).toEmitValues([1, 2, 3])).rejects;
        await rejects.toThrow();
        await rejects.toMatchInlineSnapshot(`
          [Error: [2mexpect([22m[31mreceived[39m[2m).toEmitValues([22m[32mexpected[39m[2m)[22m

          Expected [31m1[39m to be [32m"an Observable"[39m.]
        `);
      });
    });

    describe('wrong number of emitted values', () => {
      it('should fail with correct message', async () => {
        const observable = interval(10).pipe(take(3));

        const rejects = expect(() => expect(observable).toEmitValues([0, 1])).rejects;
        await rejects.toThrow();
        await rejects.toMatchInlineSnapshot(`
          [Error: [2mexpect([22m[31mreceived[39m[2m).toEmitValues([22m[32mexpected[39m[2m)[22m

            Expected observable to emit values:
              [32m[0, 1][39m
            Received:
              [31m[0, 1, 2][39m
              ]
        `);
      });
    });

    describe('wrong emitted values', () => {
      it('should fail with correct message', async () => {
        const observable = interval(10).pipe(take(3));

        const rejects = expect(() => expect(observable).toEmitValues([1, 2, 3])).rejects;
        await rejects.toThrow();
        await rejects.toMatchInlineSnapshot(`
          [Error: [2mexpect([22m[31mreceived[39m[2m).toEmitValues([22m[32mexpected[39m[2m)[22m

            Expected observable to emit values:
              [32m[1, 2, 3][39m
            Received:
              [31m[0, 1, 2][39m
              ]
        `);
      });
    });

    describe('wrong emitted value types', () => {
      it('should fail with correct message', async () => {
        const observable = (interval(10).pipe(take(3)) as unknown) as Observable<string>;

        const rejects = expect(() => expect(observable).toEmitValues(['0', '1', '2'])).rejects;
        await rejects.toThrow();
        await rejects.toMatchInlineSnapshot(`
          [Error: [2mexpect([22m[31mreceived[39m[2m).toEmitValues([22m[32mexpected[39m[2m)[22m

            Expected observable to emit values:
              [32m["0", "1", "2"][39m
            Received:
              [31m[0, 1, 2][39m
              ]
        `);
      });
    });

    describe(`observable that does not complete within ${OBSERVABLE_TEST_TIMEOUT_IN_MS}ms`, () => {
      it('should fail with correct message', async () => {
        const observable = interval(600);

        const rejects = expect(() => expect(observable).toEmitValues([0])).rejects;
        await rejects.toThrow();
        await rejects.toMatchInlineSnapshot(`
                [Error: [2mexpect([22m[31mreceived[39m[2m).toEmitValues([22m[32mexpected[39m[2m)[22m

                    Expected [31m"Observable"[39m to be [32m"completed within 1000ms"[39m but it did not.]
              `);
      });
    });
  });

  describe('passing tests', () => {
    describe('correct emitted values', () => {
      it('should pass with correct message', async () => {
        const observable = interval(10).pipe(take(3));
        await expect(observable).toEmitValues([0, 1, 2]);
      });
    });

    describe('using nested arrays', () => {
      it('should pass with correct message', async () => {
        const observable = interval(10).pipe(
          map(interval => [{ text: interval.toString(), value: interval }]),
          take(3)
        );
        await expect(observable).toEmitValues([
          [{ text: '0', value: 0 }],
          [{ text: '1', value: 1 }],
          [{ text: '2', value: 2 }],
        ]);
      });
    });

    describe('using nested objects', () => {
      it('should pass with correct message', async () => {
        const observable = interval(10).pipe(
          map(interval => ({ inner: { text: interval.toString(), value: interval } })),
          take(3)
        );
        await expect(observable).toEmitValues([
          { inner: { text: '0', value: 0 } },
          { inner: { text: '1', value: 1 } },
          { inner: { text: '2', value: 2 } },
        ]);
      });
    });

    describe('correct emitted values with throw', () => {
      it('should pass with correct message', async () => {
        const observable = (interval(10).pipe(
          map(interval => {
            if (interval > 1) {
              throw 'an error';
            }

            return interval;
          })
        ) as unknown) as Observable<string | number>;

        await expect(observable).toEmitValues([0, 1, 'an error']);
      });
    });

    describe('correct emitted values with throwError', () => {
      it('should pass with correct message', async () => {
        const observable = (interval(10).pipe(
          mergeMap(interval => {
            if (interval === 1) {
              return throwError('an error');
            }

            return of(interval);
          })
        ) as unknown) as Observable<string | number>;

        await expect(observable).toEmitValues([0, 'an error']);
      });
    });
  });
});
