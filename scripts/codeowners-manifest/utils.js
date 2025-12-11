const { readFile } = require('node:fs/promises');

const { CODEOWNERS_JSON_PATH: CODEOWNERS_MANIFEST_CODEOWNERS_PATH } = require('./constants.js');

let _codeownersCache = null;

module.exports = {
  /**
   * import the contents of the codeowners manifest JSON file, with caching
   * @param {boolean} clearCache - if true, clear the cached data and reload the codeowners manifest
   * @returns {Promise<Array<string>>} - list of codeowners which own at least one file in the project
   */
  async getCodeowners(clearCache = false) {
    if (clearCache) {
      _codeownersCache = null;
    }

    if (_codeownersCache == null) {
      try {
        const codeownersJson = await readFile(CODEOWNERS_MANIFEST_CODEOWNERS_PATH, 'utf8');
        _codeownersCache = JSON.parse(codeownersJson);
      } catch (e) {
        if (e.code === 'ENOENT') {
          console.error(`Could not read ${CODEOWNERS_MANIFEST_CODEOWNERS_PATH} ...`);
        } else {
          console.error(e);
        }
        process.exit(1);
      }
    }

    return _codeownersCache;
  },
};
