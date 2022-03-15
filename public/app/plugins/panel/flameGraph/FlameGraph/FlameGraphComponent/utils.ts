//@ts-nocheck
import { createFF } from '../flamebearer';
// not entirely sure where this should fit

function getRatios(
  // Just to provide some help, so that people don't run getRatios on viewType 'single'
  viewType: 'double',
  level: number[],
  j: number,
  leftTicks: number,
  rightTicks: number
) {
  const ff = createFF(viewType);

  // throw an error
  // since otherwise there's no way to calculate a diff
  if (!leftTicks || !rightTicks) {
    // ideally this should never happen
    // however there must be a race condition caught in CI
    // https://github.com/pyroscope-io/pyroscope/pull/439/checks?check_run_id=3808581168
    console.error("Properties 'rightTicks' and 'leftTicks' are required. Can't calculate ratio.");
    return { leftRatio: 0, rightRatio: 0 };
  }

  const leftRatio = ff.getBarTotalLeft(level, j) / leftTicks;
  const rightRatio = ff.getBarTotalRght(level, j) / rightTicks;

  return { leftRatio, rightRatio };
}

export { getRatios };
