/**
 * One longest common subsequence of two lists of distinct ids: the items that kept their relative order.
 * Items outside it are the ones that moved. Among equally long subsequences it keeps the most items with
 * `stable(id)` true (e.g. grid coordinates unchanged), then the ones that come first in `a`, so the result
 * is deterministic.
 */
export function longestCommonSubsequence(
  a: string[],
  b: string[],
  stable: (id: string) => boolean = () => true
): string[] {
  // Score = length first, then the number of stable items.
  const unit = a.length + 1;
  const score: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      score[i][j] =
        a[i] === b[j]
          ? score[i + 1][j + 1] + unit + (stable(a[i]) ? 1 : 0)
          : Math.max(score[i + 1][j], score[i][j + 1]);
    }
  }
  const result: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push(a[i]);
      i++;
      j++;
    } else if (score[i][j + 1] >= score[i + 1][j]) {
      // Skipping b's item keeps a[i] available, which favours the earlier baseline item on a tie.
      j++;
    } else {
      i++;
    }
  }
  return result;
}
