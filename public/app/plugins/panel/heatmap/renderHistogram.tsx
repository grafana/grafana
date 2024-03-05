export function renderHistogram(
  can: React.RefObject<HTMLCanvasElement>,
  histCanWidth: number,
  histCanHeight: number,
  xVals: number[],
  countVals: number[],
  index: number,
  yBucketCount: number
) {
  let histCtx = can.current?.getContext('2d');

  if (histCtx != null) {
    let fromIdx = index;

    while (xVals[fromIdx--] === xVals[index]) {}

    fromIdx++;

    let toIdx = fromIdx + yBucketCount;

    let maxCount = 0;

    let i = fromIdx;
    while (i < toIdx) {
      let c = countVals[i];
      maxCount = Math.max(maxCount, c);
      i++;
    }

    let pHov = new Path2D();
    let pRest = new Path2D();

    i = fromIdx;
    let j = 0;
    while (i < toIdx) {
      let c = countVals[i];

      if (c > 0) {
        let pctY = c / maxCount;
        let pctX = j / (yBucketCount + 1);

        let p = i === index ? pHov : pRest;

        p.rect(
          Math.round(histCanWidth * pctX),
          Math.round(histCanHeight * (1 - pctY)),
          Math.round(histCanWidth / yBucketCount),
          Math.round(histCanHeight * pctY)
        );
      }

      i++;
      j++;
    }

    histCtx.clearRect(0, 0, histCanWidth, histCanHeight);

    histCtx.fillStyle = '#2E3036';
    histCtx.fill(pRest);

    histCtx.fillStyle = '#5794F2';
    histCtx.fill(pHov);
  }
}
