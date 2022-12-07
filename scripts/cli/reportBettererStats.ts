import { betterer } from '@betterer/betterer';
import fs from 'fs';
import { camelCase } from 'lodash';
import path from 'path';

function logStat(name: string, value: number) {
  // Note that this output format must match the parsing in ci-frontend-metrics.sh
  // which expects the two values to be separated by a space
  console.log(`  - ${name} ${value}`);
}

function findConfigFile() {
  let configPath = path.resolve('.betterer.ts');
  if (fs.existsSync(configPath)) {
    return configPath;
  }
  configPath = path.resolve(__dirname, '../../', '.betterer.ts');
  return configPath;
}

async function main() {
  const cwd = process.cwd();
  let projectName = path.basename(cwd);
  try {
    const packageJsonPath = path.resolve(cwd, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    projectName = packageJson.name;
  } catch (e) {}
  console.log(`Betterer stats for ${projectName}`);
  const configFile = findConfigFile();
  const results = await betterer.results({
    configPaths: configFile,
    cwd: cwd,
    resultsPath: './.betterer.results',
  });

  for (const testResults of results.resultSummaries) {
    const countByMessage = {};
    const name = camelCase(testResults.name);
    Object.values(testResults.details)
      .flatMap((v) => v)
      .forEach((detail) => {
        const message = camelCase(detail.message);
        const metricName = `${name}_${message}`;
        if (metricName in countByMessage) {
          countByMessage[metricName]++;
        } else {
          countByMessage[metricName] = 1;
        }
      });

    for (const [metricName, count] of Object.entries<number>(countByMessage)) {
      logStat(metricName, count);
    }
  }
}

main().catch(console.error);
