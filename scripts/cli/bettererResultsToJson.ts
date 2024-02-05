import { betterer } from '@betterer/betterer';
import { writeFile } from 'fs/promises';

async function main() {
  const results = await betterer.results();
  const resultMap = {};

  for (const [suite, issueObj] of Object.entries(results)) {
    resultMap[suite] = JSON.parse(issueObj.value);
  }

  await writeFile('.betterer.results.json', JSON.stringify(resultMap, undefined, 2));
}

main().catch(console.error);
