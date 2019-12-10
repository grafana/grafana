import { BackendSrv } from 'app/core/services/backend_srv';
import { from, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { fromFetch } from 'rxjs/fetch';

jest.mock('app/core/store');
jest.mock('rxjs/fetch', () => ({
  __esModule: true,
  fromFetch: jest.fn().mockImplementation((url: string, options: any) => {
    if (url === 'gateway-error') {
      return from(Promise.reject({ status: 502 }));
    }
    return from(Promise.resolve({}));
  }),
}));

describe('backend_srv', () => {
  const _backendSrv = new BackendSrv();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when handling errors', () => {
    it('should return the http status code', async () => {
      try {
        await _backendSrv.datasourceRequest({
          url: 'gateway-error',
        });
      } catch (err) {
        expect(err.status).toBe(502);
      }
    });
  });

  it('should cancel in-flight request if new one comes in with same id', async () => {
    (fromFetch as jest.Mock)
      .mockImplementationOnce(() => of({ json: () => Promise.resolve({ testdata: 'goodbye' }) }).pipe(delay(10000)))
      .mockImplementation(() =>
        of({
          json: () => Promise.resolve({ testdata: 'hello' }),
        })
      );

    const options = {
      url: 'fakeurl',
      requestId: 'my-id',
    };

    const firstReq = _backendSrv.datasourceRequest(options);

    const res = await _backendSrv.datasourceRequest(options);
    expect(res).toStrictEqual({
      data: { testdata: 'hello' },
    });

    const firstRes = await firstReq;
    expect(firstRes).toBe(undefined);
  });
});
