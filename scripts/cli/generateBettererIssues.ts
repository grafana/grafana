import { betterer } from '@betterer/betterer';
import Codeowners from 'codeowners';

const TEST_NAME = 'no enzyme tests';

async function main() {
  const owners = new Codeowners();
  console.log(process.cwd());
  const results = await betterer.results();

  for (const testResults of results.resultSummaries) {
    if (testResults.name !== TEST_NAME) {
      continue;
    }

    if (typeof testResults.details === 'string') {
      continue;
    }

    for (const _fileName in testResults.details) {
      const fileName = _fileName.replace(process.cwd() + '/', '');
      const details = testResults.details[_fileName];
      const owner = owners.getOwner(fileName);
      const numberOfIssues = details.length;
      console.log(fileName, numberOfIssues, owner);
    }
  }
}

main().catch(console.error);
