import { Observable, Subject } from 'rxjs';
import uPlot from 'uplot';

export interface UPlotMouseEvent {
  type: string;
  src: uPlot;
  x: number;
  y: number;
  w: number;
  h: number;
  dataIdx: number;
}

const globalEvents = new Subject<UPlotMouseEvent>();

export function globalSyncFilter(
  type: string,
  src: uPlot,
  x: number,
  y: number,
  w: number,
  h: number,
  dataIdx: number
) {
  // emit to own or some other sync group
  let syncKey = src.cursor.sync!.key;

  console.log(syncKey, type, Object.keys(src.scales));

  if (globalEvents.observers.length) {
    globalEvents.next({
      type,
      src,
      x,
      y,
      w,
      h,
      dataIdx,
    });
  }

  if (syncKey.startsWith('stub__')) {
    return false; // don't process events we don't care about
  }

  // allow emit to src's own sync group
  return true; // if the instance should use this event
}

export function getGlobalUPlotEvents(): Observable<UPlotMouseEvent> {
  return globalEvents.asObservable();
}
