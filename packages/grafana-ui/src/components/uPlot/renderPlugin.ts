import uPlot from 'uplot';

export function renderPlugin({ spikes = 4, outerRadius = 8, innerRadius = 4 } = {}) {
  outerRadius *= devicePixelRatio;
  innerRadius *= devicePixelRatio;

  // https://stackoverflow.com/questions/25837158/how-to-draw-a-star-by-using-canvas-html5
  function drawStar(ctx: any, cx: number, cy: number) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  function drawPointsAsStars(u: uPlot, i: number, i0: any, i1: any) {
    let { ctx } = u;
    let { stroke, scale } = u.series[i];

    ctx.fillStyle = stroke as string;

    let j = i0;

    while (j <= i1) {
      const val = u.data[i][j] as number;
      const cx = Math.round(u.valToPos(u.data[0][j] as number, 'x', true));
      const cy = Math.round(u.valToPos(val, scale as string, true));

      drawStar(ctx, cx, cy);
      ctx.fill();

      // const zy = Math.round(u.valToPos(0, scale as string, true));

      // ctx.beginPath();
      // ctx.lineWidth = 3;
      // ctx.moveTo(cx, cy - outerRadius);
      // ctx.lineTo(cx, zy);
      // ctx.stroke();
      // ctx.fill();

      j++;
    }
  }

  return {
    opts: (u: uPlot, opts: uPlot.Options) => {
      opts.series.forEach((s, i) => {
        if (i > 0) {
          uPlot.assign(s, {
            points: {
              show: drawPointsAsStars,
            },
          });
        }
      });
    },
    hooks: {}, // can add callbacks here
  };
}
