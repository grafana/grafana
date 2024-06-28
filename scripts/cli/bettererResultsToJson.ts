import { betterer } from '@betterer/betterer';
import { writeFile } from 'fs/promises';

interface FilesByIssues {
  name: string;
  files: [
    {
      path: string;
      count: number;
    },
  ];
}
type ResultMap = Record<string, FilesByIssues[]>;

/**
 *  Produces a JSON file for consumption directly in Grafana
 */
async function main() {
  const results = await betterer.results();
  const resultMap: ResultMap = {};

  for (const suite of results.resultSummaries) {
    resultMap[suite.name] = [];
    const filesByIssues: FilesByIssues[] = [];
    // Group by message in the suite, then by file counting the number of occurrences
    for (const [file, details] of Object.entries(suite.details)) {
      const relativePath = file.replace(process.cwd(), '');
      details.forEach((element) => {
        const messageExist = filesByIssues.some((issue) => issue.name === element.message);
        // If the message does not exist, add it to the list of issues
        // With the file and start the count at 1
        if (!messageExist) {
          const name: FilesByIssues['name'] = element.message;
          filesByIssues.push({ name, files: [{ path: relativePath, count: 1 }] });
        } else {
          //If it exists, check if there is a file with the same path
          //If so, increment the count, if not, add the file to the list starting the count at 1
          const issue = filesByIssues.find((issue) => issue.name === element.message);
          if (issue?.files.find((file) => file.path === relativePath)?.count !== undefined) {
            issue.files.find((file) => file.path === relativePath)!.count++;
          } else {
            issue?.files.push({ path: relativePath, count: 1 });
          }
        }
      });
      resultMap[suite.name] = filesByIssues;
    }
  }

  await writeFile('.betterer.results.json', JSON.stringify(resultMap, undefined, 2));
}

main().catch(console.error);
