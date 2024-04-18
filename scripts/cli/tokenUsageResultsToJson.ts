const { exec } = require('child_process');
const { writeFile } = require('fs/promises');

exec('yarn themes:usage', (error, stdout, stderr) => {
  //We don't handle error as eslint throws a non-zero error code when it completes with lint errors
  //And therefore it shows 'error: Command failed: yarn themes:usage' in the console
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }
  themeTokenResultsToJson(stdout);
});

interface ThemeTokenResult {
  [token: string]: {
    [path: string]: number;
  };
}
const themeTokenResultsToJson = async (ruleResults: string) => {
  const results: ThemeTokenResult = {};
  //Split the response into blocks using the filepath as the delimiter
  const perFile: string[] = ruleResults.split('\n/');

  //Regex to match the theme token and the rule name
  const tokenRegex = new RegExp('theme.*');
  const ruleRegex = new RegExp('@grafana.*');

  perFile.forEach((file: string) => {
    //Split the block data using new line as the delimiter
    const perLine = file.split('\n');
    //Get the filepath and remove it from the array
    const filePath = perLine.shift();
    perLine.forEach((line) => {
      //Split each line of data using space as the delimiter
      const lineData = line.split(' ');
      lineData.forEach((data) => {
        if (data === '') {
          return;
        }
        //Check if the data matches a theme token name and not the rule name
        if (data.match(tokenRegex) && !data.match(ruleRegex)) {
          const token = data;
          //Check if the token already exists in the results
          if (filePath && results.hasOwnProperty(token)) {
            //Check if the filepath exists, and if so, increment the count
            if (results[token].hasOwnProperty(filePath)) {
              results[token][filePath] += 1;
            } else {
              //If the filepath does not exist, create a new entry
              results[token][filePath] = 1;
            }
          } else {
            //If the token does not exist, add it to the results as long as the filepath and its counter
            filePath && (results[token] = { [filePath]: 1 });
          }
        }
      });
    });
  });

  await writeFile('.token.results.json', JSON.stringify(results, undefined, 2));
};
