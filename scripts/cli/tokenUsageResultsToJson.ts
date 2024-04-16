const { BettererResultSummary } = require('@betterer/betterer');
const { exec } = require('child_process');
const { writeFile } = require('fs/promises');

exec('yarn themes:usage', (error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }
  themeTokenResultsToJson(stdout);
});

// interface ThemeTokenResult {
//     name: string;
//     files: [
//       {
//         path: string;
//         count: number;
//       }
//     ];
//   }
const themeTokenResultsToJson = async (ruleResults) => {
  const results = [];
  // Group by message in the suite, then by file counting the number of occurrences
  for (const [file, details] of Object.entries(ruleResults)) {
    const relativePath = file.replace(process.cwd(), '');
    //@ts-expect-error
    details.forEach((element) => {
      // @ts-expect-error
      const messageExist = results.some((issue) => issue.name === element.message);
      // If the message does not exist, add it to the list of issues
      // With the file and start the count at 1
      if (!messageExist) {
        const name = element.message;
        // @ts-expect-error
        results.push({ name, files: [{ path: relativePath, count: 1 }] });
      } else {
        //If it exists, check if there is a file with the same path
        //If so, increment the count, if not, add the file to the list starting the count at 1
        // @ts-expect-error
        const issue = results.find((issue) => issue.name === element.message);
        // @ts-expect-error
        if (issue?.files.find((file) => file.path === relativePath)?.count !== undefined) {
          // @ts-expect-error
          issue.files.find((file) => file.path === relativePath).count++;
        } else {
          // @ts-expect-error
          issue?.files.push({ path: relativePath, count: 1 });
        }
      }
    });
  }
  await writeFile('.token.results.json', JSON.stringify(results, undefined, 2));
};
