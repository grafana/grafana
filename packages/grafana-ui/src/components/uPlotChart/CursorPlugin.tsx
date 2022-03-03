import { DashboardCursorSync, DataHoverClearEvent, DataHoverEvent, LegacyGraphHoverEvent } from '@grafana/data';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMountedState } from 'react-use';
import { Subscription, throttleTime } from 'rxjs';
import uPlot from 'uplot';
import { usePanelContext } from '../PanelChrome/PanelContext';
import { positionTooltip } from '../uPlot/plugins/TooltipPlugin';
import { findMidPointYPosition } from '../uPlot/utils';
import { UPlotChartConfig, UPlotChartEvent } from './UPlotChart';

interface UPlotCursorPluginProps {
  config: UPlotChartConfig;
  children: (evt: UPlotChartEvent | null, rect: DOMRect | null) => React.ReactElement | null;
}

export const UPlotCursorPlugin = ({ config, children }: UPlotCursorPluginProps) => {
  const { sync, eventBus } = usePanelContext();
  const plotInstance = useRef<uPlot>();
  const isMounted = useMountedState();
  const [evt, setEvt] = useState<UPlotChartEvent | null>(null);
  const rect = useRef<DOMRect | null>(null);
  const subscription = useMemo(() => new Subscription(), []);

  const plotEnter = useCallback(() => {
    if (!isMounted()) {
      return;
    }

    plotInstance.current?.root.classList.add('plot-active');
  }, [isMounted]);

  const plotLeave = useCallback(() => {
    if (!isMounted()) {
      return;
    }
    setEvt(null);
    plotInstance.current?.root.classList.remove('plot-active');
  }, [isMounted, setEvt]);

  const handleCursorUpdate = useCallback((evt: DataHoverEvent | LegacyGraphHoverEvent) => {
    const time = evt.payload?.point?.time;
    const u = plotInstance.current;
    if (u && time) {
      // Try finding left position on time axis
      const left = u.valToPos(time, 'x');
      let top;
      if (left) {
        // find midpoint between points at current idx
        top = findMidPointYPosition(u, u.posToIdx(left));
      }

      if (!top || !left) {
        return;
      }

      u.setCursor({
        left,
        top,
      });
    }
  }, []);

  useLayoutEffect(() => {
    config.builder.addHook('init', (u) => {
      plotInstance.current = u;

      u.root.parentElement?.addEventListener('focus', plotEnter);
      u.over.addEventListener('mouseenter', plotEnter);

      u.root.parentElement?.addEventListener('blur', plotLeave);
      u.over.addEventListener('mouseleave', plotLeave);

      if (sync && sync() === DashboardCursorSync.Crosshair) {
        u.root.classList.add('shared-crosshair');
      }
    });

    config.builder.addHook('syncRect', (u: uPlot, newRecr: DOMRect) => {
      rect.current = newRecr;
    });

    config.builder.addHook('setCursor', (u: uPlot) => {
      if (!rect.current) {
        return;
      }
      const { x, y } = positionTooltip(u, rect.current);
      if (x != null && y != null) {
        setEvt((s) => ({ ...s, x, y } as UPlotChartEvent));
      }
    });

    config.builder.addHook('setLegend', (u) => {
      if (!isMounted()) {
        return;
      }
      const dataIdxs = u.legend.idxs!.slice();
      if (dataIdxs) {
        setEvt((s) => ({ ...s, dataIdxs } as UPlotChartEvent));
      }
    });

    config.builder.addHook('setSeries', (_, idx) => {
      if (!isMounted()) {
        return;
      }

      setEvt((s) => ({ ...s, seriesIdx: idx } as UPlotChartEvent));
    });

    return () => {
      setEvt(null);
      if (plotInstance.current) {
        plotInstance.current.over.removeEventListener('mouseleave', plotLeave);
        plotInstance.current.over.removeEventListener('mouseenter', plotEnter);
        plotInstance.current.root.parentElement?.removeEventListener('focus', plotEnter);
        plotInstance.current.root.parentElement?.removeEventListener('blur', plotLeave);
      }
    };
  }, [config, isMounted, plotEnter, plotLeave, sync]);

  useEffect(() => {
    subscription.add(
      eventBus
        .getStream(DataHoverEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: (evt) => {
            if (eventBus === evt.origin) {
              return;
            }
            handleCursorUpdate(evt);
          },
        })
    );

    // Legacy events (from flot graph)
    subscription.add(
      eventBus
        .getStream(LegacyGraphHoverEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: (evt) => handleCursorUpdate(evt),
        })
    );

    subscription.add(
      eventBus
        .getStream(DataHoverClearEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: () => {
            const u = plotInstance?.current;

            if (u) {
              u.setCursor({
                left: -10,
                top: -10,
              });
            }
          },
        })
    );
  }, []);

  if (evt?.dataIdxs && evt.x !== null && evt.y !== null) {
    return children(evt, rect.current);
  }

  return null;
};
