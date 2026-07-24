/// @ts-check

import { readdir, stat, readFile } from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const LOCALES_DIR = path.resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'locales');

const locales = await readdir(LOCALES_DIR);

/**
 * @type {Array<{ language: string, untranslatedCount: number, translatedCount: number }>}
 */
const stats = [];

for (const fileName of locales) {
  const filePath = path.join(LOCALES_DIR, fileName, 'grafana.json');
  if (!(await exists(filePath))) {
    continue;
  }

  const messages = await readFile(filePath);
  const parsedMessages = JSON.parse(messages.toString());

  let translatedCount = 0;
  let untranslatedCount = 0;

  eachMessage(parsedMessages, (value) => {
    if (value === '') {
      untranslatedCount += 1;
    } else {
      translatedCount += 1;
    }
  });

  stats.push({
    language: fileName,
    translatedCount,
    untranslatedCount,
  });
}

for (const stat of stats) {
  logStat(`untranslated.${stat.language}`, stat.untranslatedCount);
  logStat(`translated.${stat.language}`, stat.translatedCount);
}

/**
 * @param {string} filePath
 */
async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      return false;
    }
    throw err;
  }
}

/**
 * @param {unknown} value
 * @param {(v: string) => void} callback
 */
function eachMessage(value, callback) {
  if (typeof value === 'object') {
    for (const key in value) {
      const element = value[key];
      eachMessage(element, callback);
    }
  } else if (typeof value === 'string') {
    callback(value);
  } else {
    throw new Error(`Unknown value ${value} in eachMessage`);
  }
}

/**
 * @param {string} name
 * @param {string | number} value
 */
function logStat(name, value) {
  // Note that this output format must match the parsing in ci-frontend-metrics.sh
  // which expects the two values to be separated by a space
  console.log(`${name} ${value}`);
}
