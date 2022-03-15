/* eslint-disable camelcase */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-restricted-properties */
function createFF(viewType: 'single' | 'double') {
  switch (viewType) {
    case 'single': {
      return {
        format: 'single',
        jStep: 4,
        jName: 3,
        getBarOffset: (level: number[], j: number) => level[j],
        getBarTotal: (level: number[], j: number) => level[j + 1],
        getBarTotalDiff: (level: number[], j: number) => 0,
        getBarSelf: (level: number[], j: number) => level[j + 2],
        getBarSelfDiff: (level: number[], j: number) => 0,
        getBarName: (level: number[], j: number) => level[j + 3],
      };
    }
    case 'double': {
      return {
        format: 'double',
        jStep: 7,
        jName: 6,
        getBarOffset: (level: number[], j: number) => level[j] + level[j + 3],
        getBarTotal: (level: number[], j: number) => level[j + 4] + level[j + 1],
        getBarTotalLeft: (level: number[], j: number) => level[j + 1],
        getBarTotalRght: (level: number[], j: number) => level[j + 4],
        getBarTotalDiff: (level: number[], j: number) => {
          return level[j + 4] - level[j + 1];
        },
        getBarSelf: (level: number[], j: number) => level[j + 5] + level[j + 2],
        getBarSelfLeft: (level: number[], j: number) => level[j + 2],
        getBarSelfRght: (level: number[], j: number) => level[j + 5],
        getBarSelfDiff: (level: number[], j: number) => level[j + 5] - level[j + 2],
        getBarName: (level: number[], j: number) => level[j + 6],
      };
    }
    default: {
      throw new Error('Unsupported type');
    }
  }
}

function deltaDiffWrapper(format: 'single' | 'double', levels: number[][]) {
  const mutable_levels = [...levels];

  function deltaDiff(levels: number[][], start: number, step: number) {
    for (const level of levels) {
      let prev = 0;
      for (let i = start; i < level.length; i += step) {
        level[i] += prev;
        prev = level[i] + level[i + 1];
      }
    }
  }

  if (format === 'double') {
    deltaDiff(mutable_levels, 0, 7);
    deltaDiff(mutable_levels, 3, 7);
  } else {
    deltaDiff(mutable_levels, 0, 4);
  }

  return mutable_levels;
}

export { createFF, deltaDiffWrapper };
