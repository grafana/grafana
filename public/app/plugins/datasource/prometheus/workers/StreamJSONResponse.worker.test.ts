import { streamJSONResponse } from './StreamJSONResponse.worker';
import { JSON_STREAM_DONE } from './consts';
import { MockOboe } from './mocks/oboe';
import oboeOriginal from 'oboe';
import Mock = jest.Mock;

jest.mock('oboe');
const oboe = (oboeOriginal as unknown) as jest.Mock;

interface AwaitableMock extends Mock {
  waitToHaveBeenCalledTimes: (t: number) => Promise<void>;
}

// See: https://github.com/facebook/jest/issues/7432#issuecomment-443536177
const createAwaitableMock = () => {
  let resolve: (value?: unknown) => void;
  let times: number;
  let calledCount = 0;
  const mock = jest.fn() as AwaitableMock;

  mock.mockImplementation(() => {
    calledCount += 1;
    if (resolve && calledCount >= times) {
      resolve();
    }
  });
  mock.waitToHaveBeenCalledTimes = (t: number) => {
    times = t;
    return new Promise(r => {
      resolve = r;
    });
  };

  return mock;
};

function streamMockData(mockData: any[] | {}, workerOptions: Parameters<typeof streamJSONResponse>[0]): AwaitableMock {
  oboe.mockImplementationOnce(() => {
    return new MockOboe(mockData);
  });

  const cb = createAwaitableMock();
  streamJSONResponse(workerOptions, cb);
  return cb;
}

describe('StreamJSONResponse Web Worker', () => {
  it('can handle an empty response', async () => {
    let cb = streamMockData([], {
      url: '',
    });

    await cb.waitToHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, JSON_STREAM_DONE);

    cb = streamMockData(
      {},
      {
        url: '',
      }
    );

    await cb.waitToHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, JSON_STREAM_DONE);
  });

  it('chunks arrays correctly (and returns all nodes if below limit)', async () => {
    const cb = streamMockData([0, 1, 2, 3, 4], {
      url: '',
      chunkSize: 2,
    });

    await cb.waitToHaveBeenCalledTimes(4);
    expect(cb).toHaveBeenNthCalledWith(1, [0, 1]);
    expect(cb).toHaveBeenNthCalledWith(2, [2, 3]);
    expect(cb).toHaveBeenNthCalledWith(3, [4]);
    expect(cb).toHaveBeenNthCalledWith(4, JSON_STREAM_DONE);
  });

  it('chunks objects correctly (and returns all nodes if below limit)', async () => {
    const cb = streamMockData(
      {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
      },
      {
        url: '',
        chunkSize: 2,
        hasObjectResponse: true,
      }
    );

    await cb.waitToHaveBeenCalledTimes(4);
    expect(cb).toHaveBeenNthCalledWith(1, { a: 1, b: 2 });
    expect(cb).toHaveBeenNthCalledWith(2, { c: 3, d: 4 });
    expect(cb).toHaveBeenNthCalledWith(3, { e: 5 });
    expect(cb).toHaveBeenNthCalledWith(4, JSON_STREAM_DONE);
  });

  it('truncates array responses at the specified limit', async () => {
    const cb = streamMockData(['foo', 'bar', 'moo'], {
      url: '',
      limit: 2,
    });

    await cb.waitToHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, ['foo', 'bar']);
    expect(cb).toHaveBeenNthCalledWith(2, JSON_STREAM_DONE);
  });

  it('truncates object responses at the specified limit', async () => {
    const cb = streamMockData(
      {
        foo: 1,
        bar: 2,
        moo: 3,
      },
      {
        hasObjectResponse: true,
        limit: 2,
        url: '',
      }
    );

    await cb.waitToHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, { foo: 1, bar: 2 });
    expect(cb).toHaveBeenNthCalledWith(2, JSON_STREAM_DONE);
  });
});
