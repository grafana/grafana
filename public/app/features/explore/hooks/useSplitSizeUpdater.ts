import { inRange } from 'lodash';
import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'app/types';

import { splitSizeUpdateAction } from '../state/main';
import { isSplit, selectPanesEntries } from '../state/selectors';

export const useSplitSizeUpdater = (windowWidth: number) => {
  const dispatch = useDispatch();
  const panes = useSelector(selectPanesEntries);
  const hasSplit = useSelector(isSplit);
  const [rightPaneWidthRatio, setRightPaneWidthRatio] = useState(0.5);
  const [widthCalc, setWidthCalc] = useState(0);

  const minWidth = 200;
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

  useEffect(() => {
    if (hasSplit) {
      if (!exploreState.evenSplitPanes && exploreState.maxedExploreId) {
        setWidthCalc(exploreState.maxedExploreId === panes[1][0] ? windowWidth - minWidth : minWidth);
      } else if (exploreState.evenSplitPanes) {
        setWidthCalc(Math.floor(windowWidth / 2));
      } else if (rightPaneWidthRatio !== undefined) {
        setWidthCalc(windowWidth * rightPaneWidthRatio);
      }
    }
  }, [windowWidth, hasSplit, exploreState.evenSplitPanes, exploreState.maxedExploreId, panes, rightPaneWidthRatio]);

  return { updateSplitSize, widthCalc };
};
