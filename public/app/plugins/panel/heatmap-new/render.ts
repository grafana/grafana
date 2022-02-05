import uPlot from 'uplot';

interface PathbuilderOpts {
  disp: {
    fill: {
      values: (u: uPlot, seriesIndex: number) => number[];
      index: Array<CanvasRenderingContext2D['fillStyle']>;
    };
  };
}

export function heatmapPaths(opts: PathbuilderOpts) {
  const { disp } = opts;

  return (u: uPlot, seriesIdx: number) => {
    uPlot.orient(
      u,
      seriesIdx,
      (
        series,
        dataX,
        dataY,
        scaleX,
        scaleY,
        valToPosX,
        valToPosY,
        xOff,
        yOff,
        xDim,
        yDim,
        moveTo,
        lineTo,
        rect,
        arc
      ) => {
        let d = u.data[seriesIdx];
        const xs = d[0] as unknown as number[];
        const ys = d[1] as unknown as number[];
        const counts = d[2] as unknown as number[];
        const dlen = xs.length;

        // fill colors are mapped from interpolating densities / counts along some gradient
        // (should be quantized to 64 colors/levels max. e.g. 16)
        let fills = disp.fill.values(u, seriesIdx);
        let fillPalette = disp.fill.index ?? [...new Set(fills)];

        let fillPaths = fillPalette.map((color) => new Path2D());

        // detect x and y bin qtys by detecting layout repetition in x & y data
        let yBinQty = dlen - ys.lastIndexOf(ys[0]);
        let xBinQty = dlen / yBinQty;
        let yBinIncr = ys[1] - ys[0];
        let xBinIncr = xs[yBinQty] - xs[0];

        // uniform tile sizes based on zoom level
        let xSize = Math.abs(valToPosX(xBinIncr, scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff));
        let ySize = Math.abs(valToPosY(yBinIncr, scaleY, yDim, yOff) - valToPosY(0, scaleY, yDim, yOff));

        // bucket agg direction
        let xCeil = false;
        let yCeil = false;

        let xOffset = xCeil ? -xSize : 0;
        let yOffset = yCeil ? 0 : -ySize;

        // pre-compute x and y offsets
        let cys = ys.slice(0, yBinQty).map((y) => Math.round(valToPosY(y, scaleY, yDim, yOff) + yOffset));
        let cxs = Array.from({ length: xBinQty }, (v, i) =>
          Math.round(valToPosX(xs[i * yBinQty], scaleX, xDim, xOff) + xOffset)
        );

        for (let i = 0; i < dlen; i++) {
          // filter out 0 counts and out of view
          if (
            counts[i] > 0 &&
            xs[i] + xBinIncr >= scaleX.min! &&
            xs[i] - xBinIncr <= scaleX.max! &&
            ys[i] + yBinIncr >= scaleY.min! &&
            ys[i] - yBinIncr <= scaleY.max!
          ) {
            let cx = cxs[~~(i / yBinQty)];
            let cy = cys[i % yBinQty];

            let fillPath = fillPaths[fills[i]];

            rect(fillPath, cx, cy, xSize, ySize);

            /*
            qt.add({
                x: cx - size - u.bbox.left,
                y: cy - size - u.bbox.top,
                w: size * 2,
                h: size * 2,
                sidx: seriesIdx,
                didx: i
            });
        */
          }
        }

        u.ctx.save();
        //	u.ctx.globalAlpha = 0.8;
        u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();
        fillPaths.forEach((p, i) => {
          u.ctx.fillStyle = fillPalette[i];
          u.ctx.fill(p);
        });
        u.ctx.restore();

        return null;
      }
    );
  };
}

export const countsToFills = (u: uPlot, seriesIdx: number, palette: string[]) => {
  let counts = u.data[seriesIdx][2] as unknown as number[];
  let maxCount = counts.length > 65535 ? Math.max(...new Set(counts)) : Math.max(...counts);
  let cols = palette.length;

  let indexedFills = Array(counts.length);

  for (let i = 0; i < counts.length; i++) {
    indexedFills[i] = counts[i] === 0 ? -1 : Math.max(Math.round((counts[i] / maxCount) * cols) - 1, 0);
  }

  return indexedFills;
};
