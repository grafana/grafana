import { renderHook, act, waitFor } from '@testing-library/react';

import { sortByGroup, useOptions } from './useOptions';

describe('useOptions', () => {
  it('should handle a large number of synchronous options without throwing an error', () => {
    const largeOptions = Array.from({ length: 1_000_000 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `${i + 1}`,
    }));
    const { result } = renderHook(() => useOptions(largeOptions, false));

    act(() => {
      result.current.updateOptions('Option 999999');
    });

    expect(result.current.options).toEqual([{ label: 'Option 999999', value: '999999' }]);
  });

  it('should return filtered options for synchronous options', () => {
    const options = [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
    ];
    const { result } = renderHook(() => useOptions(options, false));

    act(() => {
      result.current.updateOptions('Option 1');
    });

    expect(result.current.options).toEqual([{ label: 'Option 1', value: '1' }]);
  });

  it('should handle asynchronous options', async () => {
    const asyncOptions = jest.fn().mockResolvedValue([
      { label: 'Async Option 1', value: '1' },
      { label: 'Async Option 2', value: '2' },
    ]);
    const { result } = renderHook(() => useOptions(asyncOptions, false));

    act(() => {
      result.current.updateOptions('Async');
    });

    expect(result.current.asyncLoading).toBe(true);

    await waitFor(() => expect(result.current.asyncLoading).toBe(false));

    expect(result.current.options).toEqual([
      { label: 'Async Option 1', value: '1' },
      { label: 'Async Option 2', value: '2' },
    ]);
  });

  it('should add a custom value if enabled', () => {
    const options = [
      { label: 'Apple', value: 'apple' },
      { label: 'Carrot', value: 'carrot' },
    ];
    const { result } = renderHook(() => useOptions(options, true));

    act(() => {
      result.current.updateOptions('car');
    });

    expect(result.current.options).toEqual([
      { label: 'car', value: 'car', description: 'Use custom value' },
      { label: 'Carrot', value: 'carrot' },
    ]);
  });

  it('should not add a custom value if it already exists', () => {
    const options = [
      { label: 'Apple', value: 'apple' },
      { label: 'Carrot', value: 'carrot' },
    ];
    const { result } = renderHook(() => useOptions(options, true));

    act(() => {
      result.current.updateOptions('carrot');
    });

    expect(result.current.options).toEqual([{ label: 'Carrot', value: 'carrot' }]);
  });

  it('should handle errors in asynchronous options', async () => {
    jest.spyOn(console, 'error').mockImplementation();

    const asyncOptions = jest.fn().mockRejectedValue(new Error('Async error'));
    const { result } = renderHook(() => useOptions(asyncOptions, false));

    act(() => {
      result.current.updateOptions('Async');
    });

    expect(result.current.asyncLoading).toBe(true);

    await waitFor(() => expect(result.current.asyncLoading).toBe(false));

    expect(result.current.asyncLoading).toBe(false);
    expect(result.current.asyncError).toBe(true);
  });
});

describe('sortByGroup', () => {
  it('should return original array when no groups exist', () => {
    const options = [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
      { label: 'Carrot', value: 'carrot' },
    ];

    const { options: sortedOptions, groupStartIndices } = sortByGroup(options);

    expect(sortedOptions).toBe(options); // Check reference equality
    expect(groupStartIndices.size).toBe(0);
  });

  it('should return original array when only one group exists', () => {
    const options = [
      { label: 'Apple', value: 'apple', group: 'fruits' },
      { label: 'Banana', value: 'banana', group: 'fruits' },
      { label: 'Tomato', value: 'tomato', group: 'fruits' },
    ];

    const { options: sortedOptions, groupStartIndices } = sortByGroup(options);

    expect(sortedOptions).toEqual(options);
    expect(groupStartIndices.size).toBe(1);
    expect(groupStartIndices.get('fruits')).toBe(0);
  });

  it('should group options and track group start indices', () => {
    const options = [
      { label: 'Apple', value: 'apple', group: 'fruits' },
      { label: 'Carrot', value: 'carrot', group: 'vegetables' },
      { label: 'Banana', value: 'banana', group: 'fruits' },
      { label: 'Celery', value: 'celery', group: 'vegetables' },
      { label: 'Other', value: 'other' }, // Ungrouped
    ];

    const { options: sortedOptions, groupStartIndices } = sortByGroup(options);

    expect(sortedOptions).toEqual([
      { label: 'Apple', value: 'apple', group: 'fruits' },
      { label: 'Banana', value: 'banana', group: 'fruits' },
      { label: 'Carrot', value: 'carrot', group: 'vegetables' },
      { label: 'Celery', value: 'celery', group: 'vegetables' },
      { label: 'Other', value: 'other' },
    ]);

    expect(groupStartIndices.size).toBe(2);
    expect(groupStartIndices.get('fruits')).toBe(0);
    expect(groupStartIndices.get('vegetables')).toBe(2);
  });
});
