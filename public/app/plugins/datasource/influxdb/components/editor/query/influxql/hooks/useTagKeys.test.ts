import { renderHook } from '@testing-library/react-hooks';

import { useTagKeys } from './useTagKeys';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('useTagKeys', () => {
  it('should return tag keys', async () => {
    const { result } = renderHook(() => useTagKeys(Promise.resolve(new Set(['test', 'test2']))));
    const tagKeys = await result.current.getTagKeys();
    expect(tagKeys.length).toEqual(2);
    expect(tagKeys[0]).toEqual('test');
  });

  it('should only return unselected tag keys', async () => {
    const { result } = renderHook(() =>
      useTagKeys(Promise.resolve(new Set(['test', 'test2', 'test3'])), [
        {
          key: 'test',
          value: 'test',
        },
      ])
    );
    const tagKeys = await result.current.getTagKeys();
    expect(tagKeys.length).toEqual(2);
    expect(tagKeys[0]).toEqual('test2');
  });
});
