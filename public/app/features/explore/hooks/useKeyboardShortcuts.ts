import {useEffect} from "react";
import { Unsubscribable } from "rxjs";

import { getAppEvents } from "@grafana/runtime";
import { useDispatch } from "app/types";
import { AbsoluteTimeEvent, ShiftTimeEvent, ZoomOutEvent } from "app/types/events";

import { makeAbsoluteTime, shiftTime, zoomOut } from "../state/time";

export function useKeyboardShortcuts() {
  const dispatch = useDispatch();

  useEffect(() => {
    const tearDown: Unsubscribable[] = [];

    tearDown.push(getAppEvents().subscribe(AbsoluteTimeEvent, () => {
      dispatch(makeAbsoluteTime());
    }));

    tearDown.push(getAppEvents().subscribe(ShiftTimeEvent, (event) => {
      dispatch(shiftTime(event.payload.direction))
    }));

    tearDown.push(getAppEvents().subscribe(ZoomOutEvent, (event) => {
      dispatch(zoomOut(event.payload.scale))
    }));

    return () => {
      tearDown.forEach(u => u.unsubscribe());
    }
  }, [dispatch]);
}


