const { readFile } = require('node:fs/promises');

const { CODEOWNERS_JSON_PATH: CODEOWNERS_MANIFEST_CODEOWNERS_PATH } = require('./constants.js');

let _codeownersCache = null;

const CODEOWNER_KIND = {
  TEAM: 'team',
  USER: 'user',
  EMAIL: 'email',
};

/**
 * Determine the kind of codeowner
 * @param {string} codeowner - CODEOWNERS codeowner (username, team, or email)
 * @returns {string} One of CODEOWNER_KIND values
 *
 * @example
 * getCodeownerKind('@grafana/dataviz-squad') => 'team'
 * getCodeownerKind('@jesdavpet') => 'user'
 * getCodeownerKind('john@example.com') => 'email'
 */
function getCodeownerKind(codeowner) {
  if (codeowner.includes('@') && codeowner.includes('/')) {
    return CODEOWNER_KIND.TEAM;
  } else if (codeowner.startsWith('@')) {
    return CODEOWNER_KIND.USER;
  } else {
    return CODEOWNER_KIND.EMAIL;
  }
}

/**
 * Creates a dasherized slug for any codeowner
 * @param {string} codeowner - CODEOWNERS codeowner (username, team, or email)
 * @returns {string} Dasherized slug with singular prefix
 *
 * @example
 * createCodeownerSlug('@grafana/dataviz-squad') => 'team-grafana-dataviz-squad'
 * createCodeownerSlug('@jesdavpet') => 'user-jesdavpet'
 * createCodeownerSlug('john+doe@example.com') => 'email-john-doe-at-example-com'
 */
function createCodeownerSlug(codeowner) {
  const kind = getCodeownerKind(codeowner);

  if (kind === CODEOWNER_KIND.TEAM) {
    const [org, team] = codeowner.substring(1).split('/');
    return ['team', org, team].join('-');
  } else if (kind === CODEOWNER_KIND.USER) {
    return ['user', codeowner.substring(1)].join('-');
  } else {
    const [user, domain] = codeowner.split('@');
    const sanitizedUser = user.replace(/[+.]/g, '-');
    const sanitizedDomain = domain.replace(/\./g, '-');
    return ['email', `${sanitizedUser}-at-${sanitizedDomain}`].join('-');
  }
}

module.exports = {
  CODEOWNER_KIND,
  getCodeownerKind,
  createCodeownerSlug,

  /**
   * Imports the contents of the codeowners manifest JSON file, with caching
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
