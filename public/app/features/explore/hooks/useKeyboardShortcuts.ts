import { useEffect } from 'react';
import { Unsubscribable } from 'rxjs';

import { getAppEvents } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { getState } from 'app/store/store';
import {
  AbsoluteTimeEvent,
  CopyTimeEvent,
  PasteTimeEvent,
  RunQueriesEvent,
  ShiftTimeEvent,
  ZoomOutEvent,
} from 'app/types/events';
import { useDispatch } from 'app/types/store';

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

  useEffect(() => {
    keybindings.setupTimeRangeBindings(false);

    // Explore-specific: run queries shortcut
    keybindings.bind('e r', () => {
      getAppEvents().publish(new RunQueriesEvent());
    });

    const tearDown: Unsubscribable[] = [];

    tearDown.push(
      getAppEvents().subscribe(RunQueriesEvent, () => {
        // Read panes at event time to avoid re-subscribing when panes change
        const panes = selectPanesEntries(getState());
        panes.forEach(([exploreId]) => {
          dispatch(runQueries({ exploreId }));
        });
      })
    );

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

    return () => {
      keybindings.unbind('e r');
      tearDown.forEach((u) => u.unsubscribe());
    };
  }, [dispatch, keybindings]);
}
