import { BettererFileIssue, betterer } from '@betterer/betterer';
import { writeFile } from 'fs/promises';

interface Issue {
  message: string;
  count: string;
}

type ResultMap = Record<string, Record<string, Issue[]>>;

/**
 *  Produces a JSON file for consumption directly in Grafana
 */
async function main() {
  const results = await betterer.results();
  const resultMap: ResultMap = {};

  for (const suite of results.resultSummaries) {
    resultMap[suite.name] = {};

    // Aggregate issues for each file in the suite
    for (const [file, details] of Object.entries(suite.details)) {
      const fileIssues: Issue[] = [];
      for (const issue of details) {
        const issueExists = fileIssues.find((i) => i.message === issue.message)!!;
        if (issueExists) {
          continue;
        }
        fileIssues.push({
          message: issue.message,
          count: details.filter((i: BettererFileIssue) => i.message === issue.message).length,
        });
      }
      const relativePath = file.replace(process.cwd(), '');
      resultMap[suite.name][relativePath] = fileIssues;
    }
  }

  await writeFile('.betterer.results.json', JSON.stringify(resultMap, undefined, 2));
}

main().catch(console.error);
