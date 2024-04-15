import { readFile, writeFile } from 'fs/promises';
import { format } from 'prettier';
import { pseudoize } from 'pseudoizer';

function pseudoizeJsonReplacer(key, value) {
  if (typeof value === 'string') {
    // Split string on brace-enclosed segments. Odd indices will be {{variables}}
    const phraseParts = value.split(/(\{\{[^}]+}\})/g);
    const translatedParts = phraseParts.map((str, index) => (index % 2 ? str : pseudoize(str)));
    return translatedParts.join('');
  }

  return value;
}

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
await pseudoizeJson('./public/locales/en-US/grafana.json', './public/locales/pseudo-LOCALE/grafana.json');

//
// Enterprise translations. Ignore missing file error if enterprise isn't linked
try {
  await pseudoizeJson(
    './public/app/extensions/locales/en-US/grafana-enterprise.json',
    './public/app/extensions/locales/pseudo-LOCALE/grafana-enterprise.json'
  );
} catch (err) {
  if (err.code !== 'ENOENT') {
    throw err;
  }
}
