const fs = require('fs/promises');
const pseudoizer = require('pseudoizer');
const prettier = require('prettier');

function pseudoizeJsonReplacer(key, value) {
  if (typeof value === 'string') {
    // Split string on brace-enclosed segments. Odd indices will be {{variables}}
    const phraseParts = value.split(/(\{\{[^}]+}\})/g);
    const translatedParts = phraseParts.map((str, index) => index % 2 ? str : pseudoizer.pseudoize(str))
    return translatedParts.join("")
  }

  return value;
}

fs.readFile('./public/locales/en-US/grafana.json').then((enJson) => {
  const enMessages = JSON.parse(enJson);
  // Add newline to make prettier happy
  const pseudoJson = prettier.format(JSON.stringify(enMessages, pseudoizeJsonReplacer, 2), {
    parser: 'json',
  });

  return fs.writeFile('./public/locales/pseudo-LOCALE/grafana.json', pseudoJson);
});
