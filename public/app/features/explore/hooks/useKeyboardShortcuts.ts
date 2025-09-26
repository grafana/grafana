import { useEffect } from 'react';
import { Unsubscribable } from 'rxjs';

import { getAppEvents } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { AbsoluteTimeEvent, CopyTimeEvent, PasteTimeEvent, RunQueryEvent, ShiftTimeEvent, ZoomOutEvent } from 'app/types/events';
import { ExploreItemState } from 'app/types/explore';
import { useDispatch, useSelector } from 'app/types/store';

import { runQueries } from '../state/query';
import { selectPanesEntries } from '../state/selectors';
import {
  copyTimeRangeToClipboard,
  makeAbsoluteTime,
  pasteTimeRangeFromClipboard,
  shiftTime,
  zoomOut,
} from '../state/time';

export function useKeyboardShortcuts() {
  const { keybindings } = useGrafana();
  const dispatch = useDispatch();
  const panes = useSelector(selectPanesEntries);

  useEffect(() => {
    keybindings.setupTimeRangeBindings(false);
    keybindings.setupExploreBindings();

    const tearDown: Unsubscribable[] = [];

    tearDown.push(
      getAppEvents().subscribe(AbsoluteTimeEvent, () => {
        dispatch(makeAbsoluteTime());
      })
    );

    tearDown.push(
      getAppEvents().subscribe(ShiftTimeEvent, (event) => {
        dispatch(shiftTime(event.payload.direction));
      })
    );

    tearDown.push(
      getAppEvents().subscribe(ZoomOutEvent, (event) => {
        dispatch(zoomOut(event.payload.scale));
      })
    );

    tearDown.push(
      getAppEvents().subscribe(CopyTimeEvent, () => {
        dispatch(copyTimeRangeToClipboard());
      })
    );

    tearDown.push(
      getAppEvents().subscribe(PasteTimeEvent, () => {
        dispatch(pasteTimeRangeFromClipboard());
      })
    );

    tearDown.push(
      getAppEvents().subscribe(RunQueryEvent, () => {
        // Run queries on all active panes
        panes.forEach(([exploreId]: [string, ExploreItemState]) => {
          dispatch(runQueries({ exploreId }));
        });
      })
    );

    return () => {
      tearDown.forEach((u) => u.unsubscribe());
    };
  }, [dispatch, keybindings, panes]);
}
