import uPlot from 'uplot';
import { palettes9 } from './palettes';

const yBinIncr = 10;
const xBinIncr = 60e3;

export function heatmapPaths(opts) {
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
        let [xs, ys, counts] = d;
        let dlen = xs.length;

        // fill colors are mapped from interpolating densities / counts along some gradient
        // (should be quantized to 64 colors/levels max. e.g. 16)
        let fills = disp.fill.values(u, seriesIdx);
        let fillPaths = new Map(); // #rgba => Path2D
        new Set(fills).forEach((fill) => {
          fillPaths.set(fill, new Path2D());
        });

        // detect x and y bin qtys by detecting layout repetition in x & y data
        let yBinQty = dlen - ys.lastIndexOf(ys[0]);
        let xBinQty = dlen / yBinQty;

        // uniform tile sizes based on zoom level
        let ySize = valToPosY(yBinIncr, scaleY, yDim, yOff) - valToPosY(0, scaleY, yDim, yOff);
        let xSize = valToPosX(xBinIncr, scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff);

        // pre-compute x and y offsets
        let cys = ys.slice(0, yBinQty).map((y) => Math.round(valToPosY(y, scaleY, yDim, yOff) - ySize / 2));
        let cxs = Array.from({ length: xBinQty }, (v, i) =>
          Math.round(valToPosX(xs[i * yBinQty], scaleX, xDim, xOff) - xSize / 2)
        );

        for (let i = 0; i < dlen; i++) {
          // filter out 0 counts and out of view
          if (
            counts[i] > 0 &&
            xs[i] >= scaleX.min &&
            xs[i] <= scaleX.max &&
            ys[i] >= scaleY.min &&
            ys[i] <= scaleY.max
          ) {
            let cx = cxs[Math.floor(i / yBinQty)];
            let cy = cys[i % yBinQty];

            let fillPath = fillPaths.get(fills[i]);

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
        fillPaths.forEach((p, rgba) => {
          u.ctx.fillStyle = rgba;
          u.ctx.fill(p);
        });
        u.ctx.restore();
      }
    );
  };

  return null;
}

export const countsToFills = (u: uPlot, seriesIdx: number) => {
  let palette = palettes9.Oranges.slice().reverse();
  let counts = u.data[seriesIdx][2];
  // fast but might fail for arrays > 65k; can switch to slower Math.max(...new Set(counts))
  let maxCount = Math.max(...counts);
  let cols = palette.length;

  return counts.map((v) => {
    let cIdx = Math.min(Math.floor((v / maxCount) * cols), cols - 1);
    return cIdx === 0 ? null : palette[cIdx];
  });
};
