import fs from 'fs';

//@ts-ignore It doesn't seem to import correctly, probably because it doesn end in js or ts
import resultFile from './../../.betterer.results';

// Format from betterer.results()
interface BetteterFileIssue {
  line: number;
  column: number;
  length: number;
  message: string;
  hash: string;
}

// JSON output format
interface BettererFileResult {
  path: string;
  issueMessages: string[];
  issueCount: number[];
}

type ImportedResult = Record<
  string,
  {
    value: string;
  }
>;

const resultMap = {};
const typedResult = resultFile as ImportedResult;
for (const [suite, issueObj] of Object.entries(typedResult)) {
  resultMap[suite] = JSON.parse(issueObj.value);
}

fs.writeFile('.betterer.results.json', JSON.stringify(resultMap, undefined, 2), (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log('.betterer.results.json written');
  }
});
