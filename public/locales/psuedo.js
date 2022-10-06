const fs = require('fs/promises');
const pseudoizer = require('pseudoizer');

function pseudoizeJsonReplacer(key, value) {
  if (typeof value === 'string') {
    return pseudoizer.pseudoize(value);
  }

  return value;
}

fs.readFile('./public/locales/en-US/grafana.json').then((enJson) => {
  const enMessages = JSON.parse(enJson);
  const pseudoJson = JSON.stringify(enMessages, pseudoizeJsonReplacer, 2);

  return fs.writeFile('./public/locales/pseudo-LOCALE/grafana.json', pseudoJson);
});
