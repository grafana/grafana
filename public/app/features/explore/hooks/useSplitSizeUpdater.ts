import { inRange } from 'lodash';
import { useState } from 'react';
import { useWindowSize } from 'react-use';

import { useDispatch, useSelector } from 'app/types/store';

import { splitSizeUpdateAction } from '../state/main';
import { isSplit, selectPanesEntries } from '../state/selectors';

export const useSplitSizeUpdater = (minWidth: number) => {
  const dispatch = useDispatch();
  const { width: windowWidth } = useWindowSize();
  const panes = useSelector(selectPanesEntries);
  const hasSplit = useSelector(isSplit);
  const [rightPaneWidthRatio, setRightPaneWidthRatio] = useState(0.5);

  const exploreState = useSelector((state) => state.explore);

  const updateSplitSize = (size: number) => {
    const evenSplitWidth = windowWidth / 2;
    const areBothSimilar = inRange(size, evenSplitWidth - 100, evenSplitWidth + 100);
    if (areBothSimilar) {
      dispatch(splitSizeUpdateAction({ largerExploreId: undefined }));
    } else {
      dispatch(
        splitSizeUpdateAction({
          largerExploreId: size > evenSplitWidth ? panes[1][0] : panes[0][0],
        })
      );
    }

    setRightPaneWidthRatio(size / windowWidth);
  };

  let widthCalc = 0;
  if (hasSplit) {
    if (!exploreState.evenSplitPanes && exploreState.maxedExploreId) {
      widthCalc = exploreState.maxedExploreId === panes[1][0] ? windowWidth - minWidth : minWidth;
    } else if (exploreState.evenSplitPanes) {
      widthCalc = Math.floor(windowWidth / 2);
    } else if (rightPaneWidthRatio !== undefined) {
      widthCalc = windowWidth * rightPaneWidthRatio;
    }
  }

  return { updateSplitSize, widthCalc };
};
