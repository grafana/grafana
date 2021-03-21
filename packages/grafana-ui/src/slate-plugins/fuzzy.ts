import { HighlightPart } from '../types';

type FuzzyMatch = {
  distance: number;
  ranges: HighlightPart[];
  found: boolean;
};

/**
 * Attempts to do a partial input search allowing to search for a text
 * by skipping some letters in-between.
 * The search is case sensitive! Convert stack and needle to lower case
 * to make it case insensitive.
 * @param stack - main content to be searched
 * @param needle - partial text to find in the stack
 */
export function fuzzyMatch(stack: string, needle: string): FuzzyMatch {
  let distance = 0;
  let index = stack.indexOf(needle);

  if (index !== -1) {
    return {
      distance: 0,
      found: true,
      ranges: [{ start: index, end: index + needle.length - 1 }],
    };
  }

  let letters: string[] = needle.split('');
  const ranges: HighlightPart[] = [];
  while (letters.length) {
    const letter = letters.shift();
    const letterIndex = stack.indexOf(letter!, index);
    if (letterIndex === -1) {
      return { distance: Infinity, ranges: [], found: false };
    }
    if (index !== -1) {
      distance += letterIndex - index;
    }
    index = letterIndex + 1;

    if (ranges.length === 0) {
      ranges.push({ start: letterIndex, end: letterIndex });
    } else {
      const lastRange = ranges[ranges.length - 1];
      if (letterIndex === lastRange.end + 1) {
        lastRange.end++;
      } else {
        ranges.push({ start: letterIndex, end: letterIndex });
      }
    }
  }

  return {
    distance: distance,
    ranges,
    found: true,
  };
}
