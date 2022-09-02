import { betterer, BettererFileIssues } from '@betterer/betterer';
import Codeowners from 'codeowners';
import { readFile, writeFile } from 'fs/promises';
import { template } from 'lodash';
import path from 'path';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

/*

Create an issue template by using the lodash template syntax https://lodash.com/docs/4.17.15#template. You don't need
to commit this file or put it in the grafana codebase, this tool should be able to handle it being anywhere on your fs.

For example:


The following files are using enzyme which are blocking our upgrade to React 18. When you have a moment, please work
on migrating these to React Testing Library

There are <%= totalIssueCount %> <%= plural('issue', totalIssueCount) %> over <%= fileCount %> <%= plural('file', fileCount) %>:
<% files.forEach((file) => { %>
  - [ ] <%= file.issueCount %> <%= plural('issue', file.issueCount) %> in `<%= file.fileName %>` <% }) %>

*/

const argv = yargs(hideBin(process.argv))
  .option('template', {
    demandOption: true,
    alias: 't',
    describe: 'Path to a template to use for each issue. See source of generateBettererIssues.ts for an example',
    type: 'string',
  })
  .option('output', {
    demandOption: true,
    alias: 'o',
    describe: 'Path to directory to save issues to',
    type: 'string',
  })
  .option('test', {
    demandOption: true,
    alias: 'b',
    describe: 'Name of the betterer test to produce the report for',
    type: 'string',
  })
  .option('single-owner', {
    type: 'boolean',
    alias: 's',
    describe: 'Only use first owner for files with multiple owners',
    default: false,
  })

  .usage('Usage: yarn betterer:issues -t [path] -o [path] -b [string]')
  .version(false)
  .help('help').argv;

interface FileDetails {
  fileName: string;
  issueCount: number;
  issues: BettererFileIssues;
}

// really dumb and simple pluralize function. not meant to be exhaustive
function plural(word: string, count: number) {
  if (count === 0 || count > 1) {
    return word + 's';
  }

  return word;
}

async function main() {
  const args = await argv;
  const templatePath = path.resolve(args.template);
  const outputPath = path.resolve(args.output);
  const templateString = (await readFile(templatePath)).toString();

  const owners = new Codeowners();
  const results = await betterer.results();

  const filesByOwner: Record<string, FileDetails[]> = {};

  for (const testResults of results.resultSummaries) {
    if (testResults.name !== args.test) {
      continue;
    }

    if (typeof testResults.details === 'string') {
      continue;
    }

    for (const _fileName in testResults.details) {
      const fileName = _fileName.replace(process.cwd() + '/', '');
      const details = testResults.details[_fileName];
      let ownersForFile = owners.getOwner(fileName);

      if (args.singleOwner) {
        ownersForFile = [ownersForFile[0]];
      }

      const numberOfIssues = details.length;

      for (const owner of ownersForFile) {
        if (!filesByOwner[owner]) {
          filesByOwner[owner] = [];
        }

        filesByOwner[owner].push({
          fileName,
          issueCount: numberOfIssues,
          issues: details,
        });
      }
    }
  }

  const contexts = Object.entries(filesByOwner).map(([owner, files]) => {
    const fileCount = files.length;
    const totalIssueCount = files.reduce((acc, v) => acc + v.issueCount, 0);

    return {
      owner,
      files,
      fileCount,
      totalIssueCount,
    };
  });

  const compiledTemplate = template(templateString, { imports: { plural } });

  for (const context of contexts) {
    const fileSafeOwner = context.owner.replace(/[^a-z0-9-]/gi, '_');
    const fileSafeTestName = args.test.replace(/[^a-z0-9-]/gi, '_');
    const outputFilePath = path.join(outputPath, `${fileSafeTestName}_${fileSafeOwner}.txt`);
    const printed = compiledTemplate(context);
    await writeFile(outputFilePath, printed);

    const indented = printed
      .split('\n')
      .map((v) => `\t${v}`)
      .join('\n');

    console.log(`Printed issue for owner`, context.owner, 'to', outputFilePath);
    console.log(indented);
  }
}

main().catch(console.error);
