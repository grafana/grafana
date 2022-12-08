const { parentPort, workerData } = require('node:worker_threads');

const rules = workerData.rules;
const filePaths = workerData.filePaths;
const baseDirectory = workerData.baseDirectory;

const ESLint = require('eslint').ESLint;

const cli = new ESLint({ cwd: baseDirectory });
cli.calculateConfigForFile(filePaths[0]).then(async (linterOptions) => {
  const runner = new ESLint({
    baseConfig: {
      ...linterOptions,
      rules: rules,
    },
    useEslintrc: false,
    cwd: baseDirectory,
  });
  const lintResults = await runner.lintFiles(filePaths);
  lintResults
    .filter((lintResult) => lintResult.source)
    .forEach((lintResult) => {
      lintResult.messages.forEach((message, index) => {
        parentPort.postMessage({
          filePath: lintResult.filePath,
          message: message.message,
          index: index,
        });
      });
    });
});
