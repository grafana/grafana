// @ts-check
import { readFile, writeFile } from 'fs/promises';
import { format } from 'prettier';
import { pseudoize } from 'pseudoizer';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const argv = await yargs(hideBin(process.argv))
  .option('mode', {
    demandOption: true,
    describe: 'Path to a template to use for each issue. See source bettererIssueTemplate.md for an example',
    type: 'string',
    choices: ['oss', 'enterprise', 'both'],
  })
  .version(false).argv;

const extractOSS = ['oss', 'both'].includes(argv.mode);
const extractEnterprise = ['enterprise', 'both'].includes(argv.mode);

/**
 * @param {string} key
 * @param {unknown} value
 */
function pseudoizeJsonReplacer(key, value) {
  if (typeof value === 'string') {
    // Split string on brace-enclosed segments. Odd indices will be {{variables}}
    const phraseParts = value.split(/(\{\{[^}]+}\})/g);
    const translatedParts = phraseParts.map((str, index) => (index % 2 ? str : pseudoize(str)));
    return translatedParts.join('');
  }

  return value;
}
/**
 * @param {string} inputPath
 * @param {string} outputPath
 */
async function pseudoizeJson(inputPath, outputPath) {
  const baseJson = await readFile(inputPath, 'utf-8');
  const enMessages = JSON.parse(baseJson);
  const pseudoJson = JSON.stringify(enMessages, pseudoizeJsonReplacer, 2);
  const prettyPseudoJson = await format(pseudoJson, {
    parser: 'json',
  });

  await writeFile(outputPath, prettyPseudoJson);
  console.log('Wrote', outputPath);
}

//
// OSS translations
if (extractOSS) {
  await pseudoizeJson('./public/locales/en-US/grafana.json', './public/locales/pseudo-LOCALE/grafana.json');
}

//
// Enterprise translations
if (extractEnterprise) {
  await pseudoizeJson(
    './public/app/extensions/locales/en-US/grafana-enterprise.json',
    './public/app/extensions/locales/pseudo-LOCALE/grafana-enterprise.json'
  );
}
