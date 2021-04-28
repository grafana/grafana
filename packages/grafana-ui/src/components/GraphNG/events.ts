import { KeyValue } from '@grafana/data';
import { Subject } from 'rxjs';
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

class UPlotGlobalEvents {
  private events = new Subject<UPlotMouseEvent>();
  readonly observer = this.events.asObservable();

  readonly globalKey = '__global';
  readonly localPrefix = 'local__';

  filter = (type: string, src: uPlot, x: number, y: number, w: number, h: number, dataIdx: number) => {
    // emit to own or some other sync group
    let syncKey = src.cursor.sync!.key;

    // console.log(syncKey, type, Object.keys(src.scales));

    if (this.events.observers.length) {
      this.events.next({
        type,
        src,
        x,
        y,
        w,
        h,
        dataIdx,
      });
    }

    if (syncKey.startsWith(this.localPrefix)) {
      return false; // don't process events we don't care about
    }

    // allow emit to src's own sync group
    return true; // if the instance should use this event
  };

  // Broadcast the values to all global listeners
  publish = (values: KeyValue<number>) => {
    const sync = uPlot.sync(this.globalKey);
    if (!sync) {
      return;
    }
    console.log('TODO sync uplot>>', Object.keys(values));
  };
}

export const uPlotGlobalEvents = new UPlotGlobalEvents();
