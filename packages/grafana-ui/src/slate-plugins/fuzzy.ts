import { CompletionItem } from '../types';

export default function fuzzySearch(items: CompletionItem[], text: string): CompletionItem[] {
  text = text.toLowerCase();
  return items.filter((item) => {
    const score = fuzzyMatch(item.label.toLowerCase(), text);
    if (!score) {
      return false;
    }
    item.matching = score;
    return true;
  });
}

function fuzzyMatch(stack: string, needleText: string) {
  let distance = 0;
  let index = stack.indexOf(needleText);

  if (index !== -1) {
    return {
      score: 0,
      ranges: [{ start: index, end: index + needleText.length }],
    };
  }

  let needle: string[] = needleText.split('');
  const ranges: Array<{ start: number; end: number }> = [];
  while (needle.length) {
    const letter = needle.shift();
    const letterIndex = stack.indexOf(letter!, index);
    if (letterIndex === -1) {
      return undefined;
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
    score: distance,
    ranges,
  };
}
