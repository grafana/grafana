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

    // emit to own or some other sync group
    const syncKey = src.cursor.sync!.key;
    if (syncKey.startsWith(this.localPrefix)) {
      return false; // don't process events we don't care about
    }

    // allow emit to src's own sync group
    return true; // if the instance should use this event
  };

  // Broadcast the values to all global listeners
  publish = (values: KeyValue<number>) => {
    const sync = uPlot.sync(this.globalKey);
    if (!sync || !sync.key) {
      return;
    }

    // Find all global clients and broadcast
    for (const client of sync.plots) {
      const scales = client.cursor.sync?.scales;
      if (scales?.length === 2) {
        const x = values[scales[0]];
        const y = values[scales[1]];

        const px = x == null ? -10 : client.valToPos(x, scales[0]);
        const py = y == null ? -10 : client.valToPos(y, scales[1]);

        client.setCursor({ left: px, top: py });
      }
    }
  };
}

export const uPlotGlobalEvents = new UPlotGlobalEvents();
