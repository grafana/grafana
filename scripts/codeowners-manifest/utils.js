const { readFile } = require('node:fs/promises');

const { CODEOWNERS_JSON_PATH: CODEOWNERS_MANIFEST_CODEOWNERS_PATH } = require('./constants.js');

let _codeownersCache = null;

/**
 * @enum {string}
 */
const CODEOWNER_KIND = {
  TEAM: 'team',
  USER: 'user',
  EMAIL: 'email',
  UNKNOWN: 'unknown',
};

/**
 * Determines the kind of codeowner
 * @param {string} codeowner - CODEOWNERS codeowner
 * @returns {CODEOWNER_KIND} Codeowner kind
 */
function getCodeownerKind(codeowner) {
  if (codeowner.includes('@') && codeowner.includes('/')) {
    return CODEOWNER_KIND.TEAM;
  } else if (codeowner.startsWith('@')) {
    return CODEOWNER_KIND.USER;
  } else if (codeowner.includes('@')) {
    return CODEOWNER_KIND.EMAIL;
  } else {
    return CODEOWNER_KIND.UNKNOWN;
  }
}

/**
 * Creates a dasherized slug for codeowner
 * @param {string} codeowner - CODEOWNERS codeowner
 * @returns {string} Dasherized slug with kind prefix
 */
function createCodeownerSlug(codeowner) {
  const kind = getCodeownerKind(codeowner);

  switch (kind) {
    case CODEOWNER_KIND.TEAM: {
      const [org, team] = codeowner.substring(1).split('/');
      return ['team', org, team].join('-');
    }
    case CODEOWNER_KIND.USER: {
      return ['user', codeowner.substring(1)].join('-');
    }
    case CODEOWNER_KIND.EMAIL: {
      const [user, domain] = codeowner.split('@');
      const sanitizedUser = user.replace(/[+.]/g, '-');
      const sanitizedDomain = domain.replace(/\./g, '-');
      return ['email', `${sanitizedUser}-at-${sanitizedDomain}`].join('-');
    }
    case CODEOWNER_KIND.UNKNOWN:
    default: {
      const sanitized = codeowner.replace(/[^a-zA-Z0-9]/g, '-');
      return `unknown-${sanitized}`;
    }
  }
}

module.exports = {
  CODEOWNER_KIND,
  getCodeownerKind,
  createCodeownerSlug,

  /**
   * Imports codeowners manifest with caching
   * @param {boolean} clearCache - Clear cached data and reload
   * @returns {Promise<Array<string>>} List of codeowners
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
