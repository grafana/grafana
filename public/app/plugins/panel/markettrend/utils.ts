import { MarketTrendMode, PriceDrawStyle } from './types';
import uPlot from 'uplot';
import { colorManipulator } from '@grafana/data';

const { alpha } = colorManipulator;

export function drawMarkers(opts) {
  let { mode, priceStyle, fields, upColor = '#73BF69', downColor = '#F2495C' } = opts;

  let drawPrice = mode !== MarketTrendMode.Volume && fields.high != null && fields.low != null;
  let asCandles = drawPrice && priceStyle === PriceDrawStyle.Candles;
  let drawVolume = mode !== MarketTrendMode.Price && fields.volume != null;

  let tIdx = 0,
    oIdx = fields.open,
    hIdx = fields.high,
    lIdx = fields.low,
    cIdx = fields.close,
    vIdx = fields.volume;

  return (u: uPlot) => {
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

    for (let i = idx0; i <= idx1; i++) {
      let tPx = Math.round(u.valToPos(tData[i]!, 'x', true));

      // volume
      if (drawVolume) {
        let vPx = Math.round(u.valToPos(vData![i]!, u.series[vIdx!].scale!, true));
        ctx.fillStyle = alpha(cData[i]! < oData[i]! ? downColor : upColor, 0.5);
        ctx.fillRect(tPx - barWidth / 2, vPx, barWidth, zeroPx! - vPx);
      }

      if (drawPrice) {
        // stick
        let hPx = Math.round(u.valToPos(hData![i]!, u.series[hIdx!].scale!, true));
        let lPx = Math.round(u.valToPos(lData![i]!, u.series[lIdx!].scale!, true));
        ctx.fillStyle = cData[i]! < oData[i]! ? downColor : upColor;
        ctx.fillRect(tPx - stickWidth / 2, hPx, stickWidth, lPx - hPx);

        let oPx = Math.round(u.valToPos(oData[i]!, u.series[oIdx!].scale!, true));
        let cPx = Math.round(u.valToPos(cData[i]!, u.series[cIdx!].scale!, true));
        ctx.fillStyle = cData[i]! < oData[i]! ? downColor : upColor;

        if (asCandles) {
          // rect
          let top = Math.min(oPx, cPx);
          let btm = Math.max(oPx, cPx);
          let hgt = btm - top;
          ctx.fillRect(tPx - barWidth / 2, top, barWidth, hgt);
        } else {
          ctx.fillRect(tPx - barWidth / 2, oPx, barWidth / 2, stickWidth);
          // prettier-ignore
          ctx.fillRect(tPx,                cPx, barWidth / 2, stickWidth);
        }
      }
    }
  };
}
