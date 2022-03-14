import React, { useRef } from 'react';
import clsx from 'clsx';
import useResizeObserver from '@react-hook/resize-observer';
import { Maybe } from 'true-myth';
import Flamegraph from './Flamegraph';
import Header from './Header';
import { FlamegraphPalette } from './colorPalette';

interface FlamegraphProps {
  flamebearer: any;
  focusedNode: ConstructorParameters<typeof Flamegraph>[2];
  fitMode: ConstructorParameters<typeof Flamegraph>[3];
  highlightQuery: ConstructorParameters<typeof Flamegraph>[4];
  zoom: ConstructorParameters<typeof Flamegraph>[5];

  onZoom: (bar: Maybe<{ i: number; j: number }>) => void;
  onFocusOnNode: (i: number, j: number) => void;

  onReset: () => void;
  isDirty: () => boolean;

  ExportData: () => React.ReactElement;

  ['data-testid']?: string;
  palette: FlamegraphPalette;
  setPalette: (p: FlamegraphPalette) => void;
}

export default function FlameGraphComponent(props: FlamegraphProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>();
  const flamegraph = useRef<Flamegraph>();

  const { flamebearer, focusedNode, fitMode, highlightQuery, zoom } = props;

  const { onZoom } = props;
  const { ExportData } = props;
  const { 'data-testid': dataTestId } = props;
  const { palette, setPalette } = props;

  useResizeObserver(canvasRef as React.RefObject<HTMLElement>, (e) => {
    if (flamegraph) {
      renderCanvas();
    }
  });

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const opt = flamegraph?.current?.xyToBar(e.nativeEvent.offsetX, e.nativeEvent.offsetY);

    opt?.match({
      // clicked on an invalid node
      Nothing: () => {},
      Just: (bar: any) => {
        zoom.match({
          // there's no existing zoom
          // so just zoom on the clicked node
          Nothing: () => {
            onZoom(opt);
          },

          // it's already zoomed
          Just: (z: any) => {
            // TODO there mya be stale props here...
            // we are clicking on the same node that's zoomed
            if (bar.i === z.i && bar.j === z.j) {
              // undo that zoom
              onZoom(Maybe.nothing());
            } else {
              onZoom(opt);
            }
          },
        });
      },
    });
  };

  const constructCanvas = () => {
    if (canvasRef.current) {
      const f = new Flamegraph(flamebearer, canvasRef.current, focusedNode, fitMode, highlightQuery, zoom, palette);

      flamegraph.current = f;
    }
  };

  React.useEffect(() => {
    constructCanvas();
    renderCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette]);

  React.useEffect(() => {
    constructCanvas();
    renderCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef.current, flamebearer, focusedNode, fitMode, highlightQuery, zoom]);

  const renderCanvas = () => {
    flamegraph?.current?.render();
  };

  const dataUnavailable = !flamebearer || (flamebearer && flamebearer.names.length <= 1);

  return (
    <div
      data-testid="flamegraph-view"
      className={clsx(
        {},
        {
          'vertical-orientation': flamebearer.format === 'double',
        }
      )}
      style={{ flex: 1, position: 'relative' }}
    >
      <Header
        format={flamebearer.format}
        units={flamebearer.units}
        ExportData={ExportData}
        palette={palette}
        setPalette={setPalette}
      />

      {dataUnavailable ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            position: 'relative',
            padding: '60px 0',
          }}
        >
          <span>No profiling data available for this application / time range.</span>
        </div>
      ) : null}
      <div
        data-testid={dataTestId}
        style={{
          opacity: dataUnavailable ? 0 : 1,
        }}
      >
        <canvas
          height="0"
          data-testid="flamegraph-canvas"
          data-highlightquery={highlightQuery}
          className={clsx('flamegraph-canvas', {})}
          ref={canvasRef as any}
          onClick={onClick}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}
