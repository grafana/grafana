import { lastValueFrom, of, throwError } from 'rxjs';
import { toArray } from 'rxjs/operators';

import { dataFrameToJSON, MutableDataFrame } from '@grafana/data';
import { DataResponse, FetchError } from '@grafana/runtime';

import { StartQueryRequest } from '../types';

import { runWithRetry } from './logsRetry';

describe('runWithRetry', () => {
  const timeoutPass = () => false;
  const timeoutFail = () => true;
  it('returns results if no retry is needed', async () => {
    const queryFunc = jest.fn();
    const mockFrames = [createResponseFrame('A')];
    queryFunc.mockReturnValueOnce(of(mockFrames));
    const targets = [targetA];
    const values = await lastValueFrom(runWithRetry(queryFunc, targets, timeoutPass).pipe(toArray()));
    expect(queryFunc).toBeCalledTimes(1);
    expect(queryFunc).toBeCalledWith(targets);
    expect(values).toEqual([{ frames: mockFrames }]);
  });

  it('retries if error', async () => {
    jest.useFakeTimers();
    const targets = [targetA];
    const queryFunc = jest.fn();
    const mockFrames = [createResponseFrame('A')];
    queryFunc.mockReturnValueOnce(throwError(() => createErrorResponse(targets)));
    queryFunc.mockReturnValueOnce(of(mockFrames));

    const valuesPromise = lastValueFrom(runWithRetry(queryFunc, targets, timeoutPass).pipe(toArray()));
    jest.runAllTimers();
    const values = await valuesPromise;

    expect(queryFunc).toBeCalledTimes(2);
    expect(queryFunc).nthCalledWith(1, targets);
    expect(queryFunc).nthCalledWith(2, targets);
    expect(values).toEqual([{ frames: mockFrames }]);
  });

  it('fails if reaching timeout and no data was retrieved', async () => {
    jest.useFakeTimers();
    const targets = [targetA];
    const queryFunc = jest.fn();
    queryFunc.mockReturnValueOnce(throwError(() => createErrorResponse(targets)));
    queryFunc.mockReturnValueOnce(of([createResponseFrame('A')]));

    const valuesPromise = lastValueFrom(runWithRetry(queryFunc, targets, timeoutFail).pipe(toArray()));
    jest.runAllTimers();
    let error;
    try {
      await valuesPromise;
    } catch (e) {
      error = e;
    }

    expect(queryFunc).toBeCalledTimes(1);
    expect(queryFunc).nthCalledWith(1, targets);
    expect(error).toEqual({ message: 'LimitExceededException', refId: 'A' });
  });

  it('fails if we get unexpected error', async () => {
    jest.useFakeTimers();
    const targets = [targetA];
    const queryFunc = jest.fn();
    queryFunc.mockReturnValueOnce(throwError(() => 'random error'));

    const valuesPromise = lastValueFrom(runWithRetry(queryFunc, targets, timeoutPass).pipe(toArray()));
    jest.runAllTimers();
    let error;
    try {
      await valuesPromise;
    } catch (e) {
      error = e;
    }

    expect(queryFunc).toBeCalledTimes(1);
    expect(queryFunc).nthCalledWith(1, targets);
    expect(error).toEqual('random error');
  });

  it('works with multiple queries if there is no error', async () => {
    const targets = [targetA, targetB];
    const queryFunc = jest.fn();
    const mockFrames = [createResponseFrame('A'), createResponseFrame('B')];
    queryFunc.mockReturnValueOnce(of(mockFrames));

    const values = await lastValueFrom(runWithRetry(queryFunc, targets, timeoutPass).pipe(toArray()));

    expect(queryFunc).toBeCalledTimes(1);
    expect(queryFunc).nthCalledWith(1, targets);
    expect(values).toEqual([{ frames: mockFrames }]);
  });

  it('works with multiple queries only one errors out', async () => {
    jest.useFakeTimers();
    const targets = [targetA, targetB];
    const queryFunc = jest.fn();
    queryFunc.mockReturnValueOnce(
      throwError(() =>
        createErrorResponse(targets, {
          A: { frames: [dataFrameToJSON(createResponseFrame('A'))] },
          B: { error: 'LimitExceededException' },
        })
      )
    );

    queryFunc.mockReturnValueOnce(of([createResponseFrame('B')]));

    const valuesPromise = lastValueFrom(runWithRetry(queryFunc, targets, timeoutPass).pipe(toArray()));
    jest.runAllTimers();
    const values = await valuesPromise;

    expect(queryFunc).toBeCalledTimes(2);
    expect(queryFunc).nthCalledWith(1, targets);
    expect(queryFunc).nthCalledWith(2, [targetB]);
    // Bit more involved because dataFrameToJSON and dataFrameFromJSON are not symmetrical and add some attributes to the
    // dataframe fields
    expect(values.length).toBe(1);
    expect(values[0].frames.length).toBe(2);
    expect(values[0].frames[0].fields[0].values.get(0)).toBe('A');
    expect(values[0].frames[1].fields[0].values.get(0)).toBe('B');
  });

  it('sends data and also error if only one query gets limit error', async () => {
    jest.useFakeTimers();
    const targets = [targetA, targetB];
    const queryFunc = jest.fn();
    queryFunc.mockReturnValueOnce(
      throwError(() =>
        createErrorResponse(targets, {
          A: { frames: [dataFrameToJSON(createResponseFrame('A'))] },
          B: { error: 'LimitExceededException' },
        })
      )
    );

    const valuesPromise = lastValueFrom(runWithRetry(queryFunc, targets, timeoutFail).pipe(toArray()));
    jest.runAllTimers();
    const values = await valuesPromise;

    expect(queryFunc).toBeCalledTimes(1);
    expect(queryFunc).nthCalledWith(1, targets);
    expect(values.length).toBe(1);
    expect(values[0].frames.length).toBe(1);
    expect(values[0].frames[0].fields[0].values.get(0)).toBe('A');
    expect(values[0].error).toEqual({ message: 'Some queries timed out: LimitExceededException' });
  });

  it('sends all collected successful responses on timeout', async () => {
    jest.useFakeTimers();
    const targets = [targetA, targetB, targetC];
    const queryFunc = jest.fn();
    queryFunc.mockReturnValueOnce(
      throwError(() =>
        createErrorResponse(targets, {
          A: { frames: [dataFrameToJSON(createResponseFrame('A'))] },
          B: { error: 'LimitExceededException' },
          C: { error: 'LimitExceededException' },
        })
      )
    );

    queryFunc.mockReturnValueOnce(
      throwError(() =>
        createErrorResponse(targets, {
          B: { frames: [dataFrameToJSON(createResponseFrame('B'))] },
          C: { error: 'LimitExceededException' },
        })
      )
    );

    queryFunc.mockReturnValueOnce(
      throwError(() =>
        createErrorResponse(targets, {
          C: { error: 'LimitExceededException' },
        })
      )
    );

    const valuesPromise = lastValueFrom(runWithRetry(queryFunc, targets, (retry) => retry >= 2).pipe(toArray()));
    jest.runAllTimers();
    const values = await valuesPromise;

    expect(queryFunc).toBeCalledTimes(3);
    expect(queryFunc).nthCalledWith(1, targets);
    expect(queryFunc).nthCalledWith(2, [targetB, targetC]);
    expect(queryFunc).nthCalledWith(3, [targetC]);
    expect(values.length).toBe(1);
    expect(values[0].frames.length).toBe(2);
    expect(values[0].frames[0].fields[0].values.get(0)).toBe('A');
    expect(values[0].frames[1].fields[0].values.get(0)).toBe('B');
    expect(values[0].error).toEqual({ message: 'Some queries timed out: LimitExceededException' });
  });
});

const targetA = makeTarget('A');
const targetB = makeTarget('B');
const targetC = makeTarget('C');

function makeTarget(refId: string) {
  return { queryString: 'query ' + refId, refId, region: 'test' };
}

function createResponseFrame(ref: string) {
  return new MutableDataFrame({
    fields: [{ name: 'queryId', values: [ref] }],
    refId: ref,
  });
}

function createErrorResponse(targets: StartQueryRequest[], results?: Record<string, DataResponse>): FetchError {
  return {
    status: 400,
    data: {
      results: results || {
        A: {
          error: 'LimitExceededException',
        },
      },
    },
    config: {
      url: '',
      data: {
        queries: targets,
      },
    },
  };
}
