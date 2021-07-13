import uPlot from 'uplot';
import { DataFrame } from '@grafana/data';
import { CandlestickFieldID } from './types';

// candlestick & volume renderer
export function renderOHLCV(u: uPlot, frame: DataFrame, candles = true) {
  let tIdx = 0,
    oIdx: number | null = null,
    hIdx: number | null = null,
    lIdx: number | null = null,
    cIdx: number | null = null,
    vIdx: number | null = null;

  // locate needed fields from field.state.sematicType
  frame.fields.forEach((f, i) => {
    switch (f.state!.semanticType) {
      case CandlestickFieldID.Open:
        oIdx = i;
        break;
      case CandlestickFieldID.High:
        hIdx = i;
        break;
      case CandlestickFieldID.Low:
        lIdx = i;
        break;
      case CandlestickFieldID.Close:
        cIdx = i;
        break;
      case CandlestickFieldID.Volume:
        vIdx = i;
        break;
    }
  });

  let ctx = u.ctx;

  let tData = u.data[tIdx!];

  let oData = u.data[oIdx!];
  let hData = u.data[hIdx!];
  let lData = u.data[lIdx!];
  let cData = u.data[cIdx!];
  let vData = u.data[vIdx!];

  let zeroPx = vIdx != null ? Math.round(u.valToPos(0, u.series[vIdx!].scale!, true)) : null;

  let [idx0, idx1] = u.series[0].idxs!;

  let colWidth = u.bbox.width / (idx1 - idx0);
  let barWidth = Math.round(0.6 * colWidth);
  let stickWidth = 2;

  for (let i = idx0; i <= idx1; i++) {
    let tPx = Math.round(u.valToPos(tData[i]!, 'x', true));

    // volume
    if (vIdx != null) {
      let vPx = Math.round(u.valToPos(vData[i]!, u.series[vIdx!].scale!, true));
      ctx.fillStyle = cData[i]! < oData[i]! ? '#F2495C' : '#73BF69';
      ctx.fillRect(tPx - barWidth / 2, vPx, barWidth, zeroPx! - vPx);
    }

    // stick
    let hPx = Math.round(u.valToPos(hData[i]!, u.series[hIdx!].scale!, true));
    let lPx = Math.round(u.valToPos(lData[i]!, u.series[lIdx!].scale!, true));
    ctx.fillStyle = cData[i]! < oData[i]! ? '#F2495C' : '#73BF69';
    ctx.fillRect(tPx - stickWidth / 2, hPx, stickWidth, lPx - hPx);

    let oPx = Math.round(u.valToPos(oData[i]!, u.series[oIdx!].scale!, true));
    let cPx = Math.round(u.valToPos(cData[i]!, u.series[cIdx!].scale!, true));
    ctx.fillStyle = cData[i]! < oData[i]! ? '#F2495C' : '#73BF69';

    if (candles) {
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
