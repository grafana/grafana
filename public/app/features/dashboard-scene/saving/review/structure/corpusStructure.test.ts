import { readdirSync } from 'fs';
import { join } from 'path';

import { type ReviewCorpusCase } from '../__corpus__/types';
import { emptyBaselineFor } from '../describe/emptyBaseline';
import { richToPlain } from '../richText';

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
          // What an added section holds is describe/'s: "(3 panels moved to it, 1 panel added)".
          .replace(/ \(\d+ [^()]*(?:moved to it|added)\)$/, '')
          .replace(/,? and was updated \(.*\)$/, '')
          // Header composition ("Added", "under <path>") is describe/'s; structure gives the name and move text.
          .replace(/^([+-] )(Added|Removed) /, '$1')
          .replace(/ under .*?(?= moved |$)/, '')
      )
      .filter(
        (line) =>
          /^[+-] (Panel|Row|Tab)\b/.test(line) ||
          /^(Panel|Row|Tab)\b.* moved (after|before|from) /.test(line) ||
          line.startsWith('removed with it: ') ||
          line.startsWith('• ')
      )
  );
}

/**
 * Structure's share of every corpus case, checked without describe/: the claim invariant over its diffs,
 * and the node statuses, removed contents and moved-in contents the expected text shows.
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

      const actual = structure.nodes.flatMap((node) => {
        const name = richToPlain(node.name ?? []);
        return [
          ...(node.status === 'moved' ? [`${name} ${moveStatusText(node)}`] : []),
          ...(node.status === 'added' ? [`+ ${name}`] : []),
          ...(node.status === 'removed' ? [`- ${name}`] : []),
          ...(node.removedContents ?? []).map((content) => `removed with it: ${richToPlain(content)}`),
          ...(node.movedInContents ?? []).map((content) => `• ${richToPlain(content)}`),
        ];
      });
      const wanted = expectedStatusLines(expected);
      // A moved-in element that also changed is shown as its node instead of a bullet: only the bullets shown count.
      const shown = actual.filter((line) => !line.startsWith('• ') || wanted.includes(line));
      if (JSON.stringify([...shown].sort()) !== JSON.stringify([...wanted].sort())) {
        problems.push(`${name}: statuses ${JSON.stringify(shown)}, expected ${JSON.stringify(wanted)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
