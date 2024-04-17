const { BettererResultSummary } = require('@betterer/betterer');
const { exec } = require('child_process');
const { writeFile } = require('fs/promises');

exec('yarn themes:usage', (error, stdout, stderr) => {
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
  const results = {};

  const perFile = ruleResults.split('\n/');
  let resultsPerLine = [];

  const tokenRegex = new RegExp('theme.*');
  const ruleRegex = new RegExp('@grafana.*');

  perFile.forEach((file) => {
    const perLine = file.split('\n');
    const filePath = perLine.shift();
    perLine.forEach((line) => {
      const lineData = line.split(' ');
      lineData.forEach((data) => {
        if (data === '') {
          return;
        }
        if (data.match(tokenRegex) && !data.match(ruleRegex)) {
          const token = data;
          if (results.hasOwnProperty(token)) {
            if (results[token].hasOwnProperty(filePath)) {
              results[token][filePath] += 1;
            } else {
              results[token][filePath] = 1;
            }
          } else {
            filePath && (results[token] = { [filePath]: 1 });
          }
        }
      });
    });
  });

  await writeFile('.token.results.json', JSON.stringify(results, undefined, 2));
};
