import { throttle } from 'lodash';
import { useLayoutEffect, useRef } from 'react';
import { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import {
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  DataHoverPayload,
  EventBus,
  LegacyGraphHoverEvent,
} from '@grafana/data';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

interface EventBusPluginProps {
  config: UPlotConfigBuilder;
  eventBus: EventBus;
  sync: () => boolean;
  frame?: DataFrame;
}

/**
 * @alpha
 */
export const EventBusPlugin = ({ config, eventBus, sync, frame }: EventBusPluginProps) => {
  const frameRef = useRef<DataFrame | undefined>(frame);
  frameRef.current = frame;

  useLayoutEffect(() => {
    let u: uPlot | null = null;

    const payload: DataHoverPayload = {
      point: {
        time: null,
      },
      data: frameRef.current,
    };

    config.addHook('init', (_u) => {
      u = _u;
    });

    let closestSeriesIdx: number | null = null;

    config.addHook('setSeries', (u, seriesIdx) => {
      closestSeriesIdx = seriesIdx;
    });

    config.addHook('setLegend', () => {
      let viaSync = u!.cursor.event == null;

      if (!viaSync && sync()) {
        let dataIdx = u!.cursor.idxs!.find((v) => v != null);

        if (dataIdx == null) {
          throttledClear();
        } else {
          let rowIdx = dataIdx;
          let colIdx = closestSeriesIdx;

          let xData = u!.data[0] ?? u!.data[1][0];

          payload.point.time = xData[rowIdx];
          payload.rowIndex = rowIdx ?? undefined;
          payload.columnIndex = colIdx ?? undefined;
          payload.data = frameRef.current;

          // used by old graph panel to position tooltip
          let top = u!.cursor.top!;
          payload.point.panelRelY = top === 0 ? 0.001 : top > 0 ? top / u!.rect.height : 1;

          throttledHover();
        }
      }
    });

    function handleCursorUpdate(evt: DataHoverEvent | LegacyGraphHoverEvent) {
      const time = evt.payload?.point?.time;

      if (time) {
        // Try finding left position on time axis
        const left = u!.valToPos(time, 'x');

        // let top;

        // if (left) {
        //   top = findMidPointYPosition(u!, u!.posToIdx(left));
        // }

        // if (!top || !left) {
        //   return;
        // }

        u!.setCursor({
          left,
          top: u!.rect.height / 2,
        });
      }
    }

    const subscription = new Subscription();

    const hoverEvent = new DataHoverEvent(payload).setTags(['uplot']);
    const clearEvent = new DataHoverClearEvent().setTags(['uplot']);

    let throttledHover = throttle(() => {
      eventBus.publish(hoverEvent);
    }, 100);

    let throttledClear = throttle(() => {
      eventBus.publish(clearEvent);
    }, 100);

    subscription.add(
      eventBus.getStream(DataHoverEvent).subscribe({
        next: (evt) => {
          // ignore uplot-emitted events, since we already use uPlot's sync
          if (eventBus === evt.origin || evt.tags?.has('uplot')) {
            return;
          }

          handleCursorUpdate(evt);
        },
      })
    );

    // Legacy events (from flot graph)
    subscription.add(
      eventBus.getStream(LegacyGraphHoverEvent).subscribe({
        next: (evt) => handleCursorUpdate(evt),
      })
    );

    subscription.add(
      eventBus
        .getStream(DataHoverClearEvent)
        .pipe(throttleTime(50)) // dont throttle here, throttle on emission
        .subscribe({
          next: (evt) => {
            // ignore uplot-emitted events, since we already use uPlot's sync
            if (eventBus === evt.origin || evt.tags?.has('uplot')) {
              return;
            }

            // @ts-ignore
            if (!u!.cursor._lock) {
              u!.setCursor({
                left: -10,
                top: -10,
              });
            }
          },
        })
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [config]);

  return null;
};
