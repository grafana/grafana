import React, { useLayoutEffect, useRef } from 'react';
import uPlot, { AlignedData, Options } from 'uplot';
import { debugLog } from './debug';

// make width and height optional, since they're required as dedicated props
export type OptsDimless = Omit<Options, 'width' | 'height'> & {
  width?: number;
  height?: number;
};

export interface UPlotReactProps {
  width: number;
  height: number;
  opts: OptsDimless;
  data: AlignedData; // {aligned:, stacked: }
  oninit?: (plot: uPlot | null) => void;
}

type DedicatedMethodProps = [width: number, height: number, data: AlignedData];

export const UPlotReact = ({ opts, width, height, data, oninit }: UPlotReactProps) => {
  debugLog('UPlotReact()');

  const wrap = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);

  const diffProps: DedicatedMethodProps = [width, height, data];

  const prevDiff = useRef(diffProps);

  // clean up instance when opts change or unmounts
  useLayoutEffect(() => {
    return () => {
      debugLog('u.destroy()');
      plot.current?.destroy();
      plot.current = null;
    };
  }, [opts]);

  // re-create instance if destroyed or invoke specific methods depending on what changed
  useLayoutEffect(() => {
    const [prevWidth, prevHeight, prevData] = prevDiff.current;

    if (plot.current == null) {
      debugLog('new uPlot()');
      plot.current = new uPlot({ ...opts, width, height }, data, wrap.current);
      oninit?.(plot.current);
    } else if (width !== prevWidth || height !== prevHeight) {
      debugLog('u.setSize()');
      plot.current.setSize({ width, height });
    } else if (data != prevData) {
      debugLog('u.setData()');
      plot.current.setData(data);
    }

    prevDiff.current = diffProps;
  });

  // on unmounts only. e.g. for cleanup of parent or context
  useLayoutEffect(() => {
    return () => {
      oninit?.(null);
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={wrap} />
    </div>
  );
};
