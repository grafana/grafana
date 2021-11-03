import { MarketTrendMode, MovementMode, PriceDrawStyle } from './types';
import uPlot from 'uplot';
import { colorManipulator } from '@grafana/data';

const { alpha } = colorManipulator;

export function drawMarkers(opts) {
  let {
    mode,
    priceStyle,
    fields,
    movementMode,
    upColor = '#73BF69',
    downColor = '#F2495C',
    flatColor,
    volumeAlpha,
  } = opts;

  let drawPrice = mode !== MarketTrendMode.Volume && fields.high != null && fields.low != null;
  let asCandles = drawPrice && priceStyle === PriceDrawStyle.Candles;
  let drawVolume = mode !== MarketTrendMode.Price && fields.volume != null;

  function selectPath(priceDir: number, flatPath: Path2D, upPath: Path2D, downPath: Path2D) {
    return priceDir > 0 ? upPath : priceDir < 0 ? downPath : flatPath;
  }

  let tIdx = 0,
    oIdx = fields.open,
    hIdx = fields.high,
    lIdx = fields.low,
    cIdx = fields.close,
    vIdx = fields.volume;

  return (u: uPlot) => {
    // split by discrete color to reduce draw calls
    let downPath, upPath, flatPath;
    // with adjusted reduced
    let downPathVol, upPathVol, flatPathVol;

    if (drawPrice) {
      flatPath = new Path2D();
      upPath = new Path2D();
      downPath = new Path2D();
    }

    if (drawVolume) {
      downPathVol = new Path2D();
      upPathVol = new Path2D();
      flatPathVol = new Path2D();
    }

    let hollowPath = new Path2D();

    let ctx = u.ctx;

    let tData = u.data[tIdx!];

    let oData = u.data[oIdx!];
    let cData = u.data[cIdx!];

    let hData = drawPrice ? u.data[hIdx!] : null;
    let lData = drawPrice ? u.data[lIdx!] : null;
    let vData = drawVolume ? u.data[vIdx!] : null;

    let zeroPx = vIdx != null ? Math.round(u.valToPos(0, u.series[vIdx!].scale!, true)) : null;

    let [idx0, idx1] = u.series[0].idxs!;

    let colWidth = u.bbox.width / (idx1 - idx0);
    let barWidth = Math.round(0.6 * colWidth);

    let stickWidth = 2;
    let outlineWidth = 2;

    if (barWidth < 8) {
      stickWidth = outlineWidth = 1;
    }

    let halfWidth = Math.floor(barWidth / 2);

    for (let i = idx0; i <= idx1; i++) {
      let tPx = Math.round(u.valToPos(tData[i]!, 'x', true));

      // current close vs prior close
      let interDir = i === 0 ? 0 : Math.sign(cData[i]! - cData[i - 1]!);
      // current close vs current open
      let intraDir = Math.sign(cData[i]! - oData[i]!);

      // volume
      if (drawVolume) {
        let outerPath = selectPath(
          asCandles && movementMode === MovementMode.Hollow ? interDir : intraDir,
          flatPathVol,
          upPathVol,
          downPathVol
        );

        let vPx = Math.round(u.valToPos(vData![i]!, u.series[vIdx!].scale!, true));
        outerPath.rect(tPx - halfWidth, vPx, barWidth, zeroPx! - vPx);
      }

      if (drawPrice) {
        let outerPath = selectPath(
          asCandles && movementMode === MovementMode.Hollow ? interDir : intraDir,
          flatPath,
          upPath,
          downPath
        );

        // stick
        let hPx = Math.round(u.valToPos(hData![i]!, u.series[hIdx!].scale!, true));
        let lPx = Math.round(u.valToPos(lData![i]!, u.series[lIdx!].scale!, true));
        outerPath.rect(tPx - Math.floor(stickWidth / 2), hPx, stickWidth, lPx - hPx);

        let oPx = Math.round(u.valToPos(oData[i]!, u.series[oIdx!].scale!, true));
        let cPx = Math.round(u.valToPos(cData[i]!, u.series[cIdx!].scale!, true));

        if (asCandles) {
          // rect
          let top = Math.min(oPx, cPx);
          let btm = Math.max(oPx, cPx);
          let hgt = btm - top;
          outerPath.rect(tPx - halfWidth, top, barWidth, hgt);

          if (movementMode === MovementMode.Hollow) {
            if (intraDir >= 0) {
              hollowPath.rect(
                tPx - halfWidth + outlineWidth,
                top + outlineWidth,
                barWidth - outlineWidth * 2,
                hgt - outlineWidth * 2
              );
            }
          }
        } else {
          outerPath.rect(tPx - halfWidth, oPx, halfWidth, stickWidth);
          // prettier-ignore
          outerPath.rect(tPx,                cPx, halfWidth, stickWidth);
        }
      }
    }

    ctx.save();

    if (drawVolume) {
      ctx.fillStyle = alpha(upColor, volumeAlpha);
      ctx.fill(upPathVol);

      ctx.fillStyle = alpha(downColor, volumeAlpha);
      ctx.fill(downPathVol);

      ctx.fillStyle = alpha(flatColor, volumeAlpha);
      ctx.fill(flatPathVol);
    }

    if (drawPrice) {
      ctx.fillStyle = upColor;
      ctx.fill(upPath);

      ctx.fillStyle = downColor;
      ctx.fill(downPath);

      ctx.fillStyle = flatColor;
      ctx.fill(flatPath);

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(hollowPath);
    }

    ctx.restore();
  };
}
