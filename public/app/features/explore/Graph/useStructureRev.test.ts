declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveIncremented(): CustomMatcherResult;
    }
  }
}

import { renderHook } from '@testing-library/react';

import { DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { useStructureRev } from './useStructureRev';

let lastResult: number = Number.MIN_SAFE_INTEGER;

const resetCounters = () => {
  lastResult = Number.MIN_SAFE_INTEGER;
};

const startCounters = (start: number | Error) => {
  // The if is only to make TypeScript happy
  if (start instanceof Error) {
    expect(start).not.toBeInstanceOf(Error);
    return;
  }

  lastResult = start;
};

beforeAll(() => {
  expect.extend({
    toHaveIncremented(received: number[]) {
      if (received.length < 2) {
        return {
          message: () => `expected at least 2 elements, got ${received.length}`,
          pass: false,
        };
      }

      const pass = received[received.length - 1] > lastResult;
      const r = lastResult;

      const message = () =>
        this.isNot
          ? `expected ${received[received.length - 1]} to be equal or lesser than ${r}`
          : `expected ${received[received.length - 1]} to be greater than ${r}`;

      lastResult = received[received.length - 1];

      return {
        message,
        pass,
      };
    },
  });
});

describe('useStructureRev', () => {
  afterEach(() => resetCounters());

  // mirrors the logic in componentDidUpdate in packages/grafana-ui/src/components/GraphNG/GraphNG.tsx,
  // which treats all falsy values for structureRev as a signal to reconfig the graph
  it('should start from a truthy value', () => {
    let frames: DataFrame[] = [toDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }] })];
    const { result } = renderHook((frames) => useStructureRev(frames), { initialProps: frames });

    expect(result.current).not.toBeFalsy();
  });

  it('should increment only when relevant fields in frame change', () => {
    let all: number[] = [];
    let frames: DataFrame[] = [toDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }] })];
    const { result, rerender } = renderHook(
      (frames) => {
        const result = useStructureRev(frames);
        all.push(result);
        return result;
      },
      { initialProps: frames }
    );
    startCounters(result.current);

    // When changing number of frames, the structureRev should increment
    frames = [...frames, toDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }] })];
    rerender(frames);
    expect(all).toHaveIncremented();

    // Changing RefId should not increment the structure revision
    frames[0] = toDataFrame({
      refId: 'A',
      fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
    });
    rerender([...frames]);
    expect(all).not.toHaveIncremented();

    // Changing frame name should increment the structure revision
    frames[0] = toDataFrame({
      refId: 'A',
      name: 'Some Name',
      fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
    });
    rerender([...frames]);
    expect(all).toHaveIncremented();

    // Changing frame's fields number should increment the structure revision
    frames[0] = toDataFrame({
      refId: 'A',
      name: 'Some Name',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    rerender([...frames]);
    expect(all).toHaveIncremented();

    // Changing a frame's field's config should increment the structure revision
    frames[0] = toDataFrame({
      refId: 'A',
      name: 'Some Name',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3], config: { unit: 'ms' } },
      ],
    });
    rerender([...frames]);
    expect(all).toHaveIncremented();

    // Changing a frame's field's name should increment the structure revision
    frames[0] = toDataFrame({
      refId: 'A',
      name: 'Some Name',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'value, but with a different name', type: FieldType.number, values: [1, 2, 3], config: { unit: 'ms' } },
      ],
    });
    rerender([...frames]);
    expect(all).toHaveIncremented();
  });
});
