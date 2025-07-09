import { useEffect } from 'react';
import { Unsubscribable } from 'rxjs';

import { getAppEvents } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { AbsoluteTimeEvent, CopyTimeEvent, PasteTimeEvent, ShiftTimeEvent, ZoomOutEvent } from 'app/types/events';
import { useDispatch } from 'app/types/store';

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

    return () => {
      tearDown.forEach((u) => u.unsubscribe());
    };
  }, [dispatch, keybindings]);
}
