import { type QueryEditorCoauthoringContextV1 } from './internalCoauthoringContract';

export interface QueryCoauthoringDiffHunk {
  from: number;
  to: number;
  original: string;
  proposed: string;
  focus: 'inside' | 'outside';
}

function tokenize(query: string): string[] {
  return (
    query.match(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\x60[^\x60]*\x60|[\p{L}_][\p{L}\p{N}_]*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\s+|./gu
    ) ?? []
  );
}

function commonLengths(original: string[], proposed: string[]): Uint32Array {
  const row = new Uint32Array(proposed.length + 1);
  for (const token of original) {
    let diagonal = 0;
    for (let index = 0; index < proposed.length; index++) {
      const previous = row[index + 1];
      row[index + 1] = token === proposed[index] ? diagonal + 1 : Math.max(previous, row[index]);
      diagonal = previous;
    }
  }
  return row;
}

// Avoid a quadratic diff matrix when the Assistant replaces a long query.
function matchingTokens(
  original: string[],
  proposed: string[],
  originalOffset = 0,
  proposedOffset = 0
): Array<[number, number]> {
  const matches: Array<[number, number]> = [];
  let prefix = 0;
  while (prefix < original.length && prefix < proposed.length && original[prefix] === proposed[prefix]) {
    matches.push([originalOffset + prefix, proposedOffset + prefix]);
    prefix++;
  }
  if (prefix > 0) {
    return matches.concat(
      matchingTokens(original.slice(prefix), proposed.slice(prefix), originalOffset + prefix, proposedOffset + prefix)
    );
  }
  if (original.length === 0 || proposed.length === 0) {
    return matches;
  }
  if (original.length === 1) {
    const index = proposed.indexOf(original[0]);
    return index < 0 ? [] : [[originalOffset, proposedOffset + index]];
  }
  const middle = Math.floor(original.length / 2);
  const before = commonLengths(original.slice(0, middle), proposed);
  const after = commonLengths(original.slice(middle).reverse(), [...proposed].reverse());
  let split = 0;
  let longest = -1;
  for (let index = 0; index <= proposed.length; index++) {
    const length = before[index] + after[proposed.length - index];
    if (length > longest) {
      longest = length;
      split = index;
    }
  }
  return matchingTokens(original.slice(0, middle), proposed.slice(0, split), originalOffset, proposedOffset).concat(
    matchingTokens(original.slice(middle), proposed.slice(split), originalOffset + middle, proposedOffset + split)
  );
}

export function queryCoauthoringDiff(
  baseline: string,
  proposed: string,
  focusRanges: QueryEditorCoauthoringContextV1['focusRanges']
): QueryCoauthoringDiffHunk[] {
  const originalTokens = tokenize(baseline);
  const proposedTokens = tokenize(proposed);
  const matches = matchingTokens(originalTokens, proposedTokens);
  matches.push([originalTokens.length, proposedTokens.length]);
  const hunks: QueryCoauthoringDiffHunk[] = [];
  let originalIndex = 0;
  let proposedIndex = 0;
  let from = 0;
  for (const [originalMatch, proposedMatch] of matches) {
    const original = originalTokens.slice(originalIndex, originalMatch).join('');
    const proposed = proposedTokens.slice(proposedIndex, proposedMatch).join('');
    const to = from + original.length;
    if (original.trim() || proposed.trim()) {
      const inside = focusRanges.some((range) =>
        from === to ? range.from < from && from < range.to : range.from <= from && to <= range.to
      );
      hunks.push({ from, to, original, proposed, focus: inside ? 'inside' : 'outside' });
    }
    from = to + (originalTokens[originalMatch]?.length ?? 0);
    originalIndex = originalMatch + 1;
    proposedIndex = proposedMatch + 1;
  }
  return hunks;
}
