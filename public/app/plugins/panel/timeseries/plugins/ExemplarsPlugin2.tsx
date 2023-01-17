import { useLayoutEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';

import { DataFrame, FieldType } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { UPlotConfigBuilder } from '@grafana/ui';

import Flatbush from '../../barchart/flatbush.esm';

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

    let fb: Flatbush;
    let built = false;
    let hovIdx: number | null;

    let xScaleKey = 'x';
    let yScaleKey: string;

    config.addHook('init', (u) => {
      yScaleKey = u.series[1].scale!;
      u.under.appendChild(hoverRect);

      u.over.addEventListener('mouseenter', e => {
        if (!built) {
          fb.finish();
          built = true;
        }
      });
    });

    config.addHook('drawClear', (u) => {
      // qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);
      // qt.clear();
      fb = new Flatbush(exemplars.length, 512, Int16Array as unknown as Float64ArrayConstructor);
    });

    config.addHook('setCursor', u => {
      let hovIdxNew: number | null = null;

      if (u.cursor.top! < 0) {
        hoverRect.style.display = 'none';
        return;
      }

      let cx = u.cursor.left! * uPlot.pxRatio;
      let cy = u.cursor.top! * uPlot.pxRatio;

      let flatIdxs = fb.search(cx, cy, cx + 1, cy + 1);

      if (flatIdxs.length > 0) {
        for (let j = 0; j < flatIdxs.length; j++) {
            hovIdxNew = flatIdxs[j];

            if (hovIdxNew != hovIdx) {
              let offs = fb!._indices!.indexOf(hovIdxNew) * 4;
              let minX = fb!._boxes![offs++];
              let minY = fb!._boxes![offs++];
              // let maxX = fb._boxes[offs++];
              // let maxY = fb._boxes[offs++];

              if (hovIdx == null) {
                hoverRect.style.display = '';
              }

              hoverRect.style.translate = `${minX / uPlot.pxRatio}px ${minY / uPlot.pxRatio}px`;
            }

            break;
        }
      } else if (hovIdx != null) {
        hoverRect.style.display = 'none';
      }

      hovIdx = hovIdxNew;
    });

    config.addHook('draw', (u) => {
      u.ctx.save();

      let ptSizeCan = ptSizeCss * uPlot.pxRatio;
      let ptHalfCan = ptSizeCan/2;

      let bboxLeft = u.bbox.left;
      let bboxTop = u.bbox.top;

      exemplarIdxsByColor.forEach((idxs, color) => {
        u.ctx.fillStyle = color;

        for (let i = 0; i < idxs.length; i++) {
          let idx = idxs[i];
          let cx = u.valToPos(xVals[idx], xScaleKey, true);
          let cy = u.valToPos(yVals[idx], yScaleKey, true);

          // clamp out-of-range values
          cy = Math.max(cy, bboxTop);

          drawMark(u.ctx, cx, cy, ptSizeCan);

          fb.add(
            Math.round(cx - ptHalfCan - bboxLeft),
            Math.round(cy - ptHalfCan - bboxTop),
            Math.round(cx + ptHalfCan - bboxLeft),
            Math.round(cy + ptHalfCan - bboxTop),
          );
        }
      });

      u.ctx.restore();

      built = false;
    });
  }, [config, exemplarIdxsByColor]);

  return null;
};

ExemplarsPlugin2.displayName = 'ExemplarsPlugin2';
