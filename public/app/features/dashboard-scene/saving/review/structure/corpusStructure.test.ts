import { readdirSync } from 'fs';
import { join } from 'path';

import { type ReviewCorpusCase } from '../__corpus__/types';
import { emptyBaselineFor } from '../describe/emptyBaseline';

import { buildStructure } from './buildStructure';
import { claimProblems, layoutDiffsOf, moveStatusText } from './testUtils';

const casesDir = join(__dirname, '../__corpus__/cases');

async function loadCases(): Promise<ReviewCorpusCase[]> {
  const files = readdirSync(casesDir).filter((file) => file.endsWith('.ts') && file !== 'index.ts');
  const modules = await Promise.all(files.map((file) => import(join(casesDir, file))));
  return modules.flatMap((module) => Object.values<ReviewCorpusCase>(module));
}

/** The node headers with a status and the "removed with it" lines, as the corpus expects them. */
function expectedStatusLines(expected: string): string[] {
  return (
    expected
      .split('\n')
      // describe/ appends "and was updated (…)" to the move text; only the move part is structure's.
      .map((line) =>
        line
          .trim()
          .replace(/ · .*$/, '')
          .replace(/,? and was updated \(.*\)$/, '')
      )
      .filter(
        (line) =>
          /^[+-] (Panel|Row|Tab)\b/.test(line) ||
          /^(Panel|Row|Tab)\b.* moved (after|before|from) /.test(line) ||
          line.startsWith('removed with it: ')
      )
  );
}

/**
 * Structure's share of every corpus case, checked without describe/: the claim invariant over its diffs,
 * and the node statuses and removed contents the expected text shows.
 */
describe('buildStructure over the corpus', () => {
  it('claims every layout diff exactly once and shows the expected statuses', async () => {
    const cases = await loadCases();
    expect(cases.length).toBeGreaterThan(0);

    const problems: string[] = [];
    for (const { name, input, expected } of cases) {
      const baseline = input.mode === 'new' || !input.baseline ? emptyBaselineFor(input.payload) : input.baseline;
      const diffs = layoutDiffsOf(baseline, input.payload);
      const structure = buildStructure(baseline, input.payload, diffs);
      problems.push(...claimProblems(structure, diffs).map((problem) => `${name}: ${problem}`));

      const actual = structure.nodes.flatMap((node) => [
        ...(node.status === 'moved' ? [`${node.label} ${moveStatusText(node)}`] : []),
        ...(node.status === 'added' ? [`+ ${node.label}`] : []),
        ...(node.status === 'removed' ? [`- ${node.label}`] : []),
        ...(node.removedContents ?? []).map((content) => `removed with it: ${content}`),
      ]);
      const wanted = expectedStatusLines(expected);
      if (JSON.stringify([...actual].sort()) !== JSON.stringify([...wanted].sort())) {
        problems.push(`${name}: statuses ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
