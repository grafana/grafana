import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { initialExploreState } from 'app/features/explore/state/main';
import { makeExplorePaneState } from 'app/features/explore/state/utils';
import { configureStore } from 'app/store/configureStore';

import { splitSizeUpdateAction } from '../state/main';

import { useSplitSizeUpdater } from './useSplitSizeUpdater';

describe('useSplitSizeUpdater', () => {
  it('dispatches correct action and calculates widthCalc correctly', () => {
    const store = configureStore({
      explore: {
        ...initialExploreState,
        panes: {
          left: makeExplorePaneState(),
          right: makeExplorePaneState(),
        },
      },
    });

    const minWidth = 200;

    const dispatchMock = jest.fn().mockImplementation(store.dispatch);

    const { result } = renderHook(() => useSplitSizeUpdater(minWidth), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestProvider store={{ ...store, dispatch: dispatchMock }}>{children}</TestProvider>
      ),
    });

    // 1. Panes have similar width
    act(() => {
      result.current.updateSplitSize(450);

      expect(dispatchMock).toHaveBeenCalledWith(splitSizeUpdateAction({ largerExploreId: undefined }));
      expect(result.current.widthCalc).toBe(512);
    });

    // 2. Left pane is larger
    act(() => {
      result.current.updateSplitSize(300);
    });
    expect(dispatchMock).toHaveBeenCalledWith(splitSizeUpdateAction({ largerExploreId: 'left' }));
    expect(result.current.widthCalc).toBe(300);

    // 3. Right pane is larger
    act(() => {
      result.current.updateSplitSize(700);
    });
    expect(dispatchMock).toHaveBeenCalledWith(splitSizeUpdateAction({ largerExploreId: 'right' }));
    expect(result.current.widthCalc).toBe(700);
  });
});
