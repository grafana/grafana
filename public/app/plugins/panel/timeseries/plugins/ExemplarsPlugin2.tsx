import { useLayoutEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';

import { DataFrame, FieldType } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { UPlotConfigBuilder } from '@grafana/ui';

import { pointWithin, Quadtree, Rect } from '../../barchart/quadtree';

interface ExemplarsPlugin2Props {
  config: UPlotConfigBuilder;
  exemplars: DataFrame;
  matchByField: string;
  seriesLabels: string[];
  onHover?: (exemplarIdx: number, x: number, y: number) => void;
  onLeave?: (exemplarIdx: number) => void;
  // timeZone: TimeZone;
  // getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

// diamonds!
let ptSizeCss = 7; // in logical pixels
// let halfDiagMult = Math.sqrt(2) / 2;

// TODO: writing this shape to a raster sprite and then drawImage/imageSmoothingEnabled
// is probably faster than looped moveTo/lineTo/fill commands (for complex shapes)
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size = 7) {
  // let halfDiag = size * halfDiagMult;
  let halfDiag = size / 2;

  ctx.beginPath();
  ctx.moveTo(x - halfDiag, y);
  ctx.lineTo(x, y - halfDiag);
  ctx.lineTo(x + halfDiag, y);
  ctx.lineTo(x, y + halfDiag);
  ctx.fill();
}

export const ExemplarsPlugin2 = ({ config, exemplars, matchByField, seriesLabels }: ExemplarsPlugin2Props) => {
  let exemplarsRef = useRef<DataFrame>(exemplars);

  exemplarsRef.current = exemplars;

  // filter out exemplars of hidden series, group by color to minimize ctx.fillStyle mutation
  let exemplarIdxsByColor = useMemo(() => {
    let seriesLabelsToIdx = new Map();
    seriesLabels.forEach((l, i) => seriesLabelsToIdx.set(l, i));

    let exemplarLabels = exemplars.fields.find((f) => f.name === matchByField)!.values.toArray();
    let seriesColors = config.series.map((s) => alpha(s.props.lineColor!, 0.5));
    let seriesVisible = config.series.map((s) => s.props.show);

    let exemplarIdxsByColor = new Map<string, number[]>();

    for (let i = 0; i < exemplarLabels.length; i++) {
      let label = exemplarLabels[i];
      let seriesIdx = seriesLabelsToIdx.get(label);

      if (seriesVisible[seriesIdx]) {
        let seriesColor = seriesColors[seriesIdx];
        let exemplarIdxs = exemplarIdxsByColor.get(seriesColor);

        if (exemplarIdxs == null) {
          exemplarIdxs = [];
          exemplarIdxsByColor.set(seriesColor, exemplarIdxs);
        }

        exemplarIdxs.push(i);
      }
    }

    return exemplarIdxsByColor;
  }, [config.series, exemplars, matchByField, seriesLabels]);


  let { xVals, yVals } = useMemo(() => {
    return {
      xVals: exemplars.fields.find((f) => f.type === FieldType.time)!.values.toArray(),
      yVals: exemplars.fields.find((f) => f.name === 'Value')!.values.toArray(),
    }
  }, [exemplars]);

  useLayoutEffect(() => {
    let hoverRect = document.createElement('div');
    hoverRect.style.background = 'rgba(255,255,255,0.5)';
    hoverRect.style.position = 'absolute';
    hoverRect.style.transformOrigin = '0 0';
    hoverRect.style.borderRadius = '50%';
    hoverRect.style.left = '0';
    hoverRect.style.top = '0';
    hoverRect.style.width = `${ptSizeCss}px`;
    hoverRect.style.height = `${ptSizeCss}px`;

    let qt: Quadtree;
    let hRect: Rect | null;

    let xScaleKey = 'x';
    let yScaleKey: string;

    config.addHook('init', (u) => {
      yScaleKey = u.series[1].scale!;
      u.under.appendChild(hoverRect);
    });

    config.addHook('drawClear', (u) => {
      qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

      qt.clear();
    });

    config.addHook('setCursor', u => {
      let hRectNew: Rect | null = null;

      let cx = u.cursor.left! * uPlot.pxRatio;
      let cy = u.cursor.top! * uPlot.pxRatio;

      qt.get(cx, cy, 1, 1, (o) => {
        if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
          hRectNew = o;
        }
      });

      if (hRectNew != hRect) {
        if (hRectNew) {
          hoverRect.style.display = '';
          hoverRect.style.translate = `${(hRectNew.x) / uPlot.pxRatio}px ${(hRectNew.y) / uPlot.pxRatio}px`;
          // hoverRect.style.background = '';
        } else {
          hoverRect.style.display = 'none';
        }

        hRect = hRectNew;
      }
    });

    config.addHook('draw', (u) => {
      u.ctx.save();

      let ptSizeCan = ptSizeCss * uPlot.pxRatio;

      exemplarIdxsByColor.forEach((idxs, color) => {
        u.ctx.fillStyle = color;

        for (let i = 0; i < idxs.length; i++) {
          let idx = idxs[i];
          let cx = u.valToPos(xVals[idx], xScaleKey, true);
          let cy = u.valToPos(yVals[idx], yScaleKey, true);

          cy = Math.max(cy, u.bbox.top);

          drawMark(u.ctx, cx, cy, ptSizeCan);

          qt.add({
            x: cx - ptSizeCan/2 - u.bbox.left,
            y: cy - ptSizeCan/2 - u.bbox.top,
            w: ptSizeCan,
            h: ptSizeCan,
            sidx: 0,
            didx: idx,
          });
        }
      });

      u.ctx.restore();
    });
  }, [config, exemplarIdxsByColor]);

  return null;
};

ExemplarsPlugin2.displayName = 'ExemplarsPlugin2';
