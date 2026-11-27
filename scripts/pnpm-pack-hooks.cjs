// Loaded only by `packages:pack` via pnpm_config_pnpmfile. As a root .pnpmfile.cjs, pnpm records
// its checksum in pnpm-lock.yaml, and Renovate (which installs with --ignore-pnpmfile) drops it,
// breaking frozen installs on every Renovate PR.
const { execSync } = require('node:child_process');

const SOURCE_CONDITION = '@grafana-app/source';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Removes all mentions of `@grafana-app/source` at pack time so consumers cannot end up with references to source
// code that doesn't exist in the published packages
function stripSourceCondition(exportsMap) {
  const stripped = {};
  for (const [key, value] of Object.entries(exportsMap)) {
    if (key === SOURCE_CONDITION) {
      continue;
    }
    if (!isPlainObject(value)) {
      stripped[key] = value;
      continue;
    }
    const strippedValue = stripSourceCondition(value);
    if (Object.keys(strippedValue).length > 0) {
      stripped[key] = strippedValue;
    }
  }
  return stripped;
}

// npm only records gitHead when publishing from a git working directory. We publish pre-packed
// tarballs, so it is stamped here for the nightly change detection that reads it back.
function resolveGitHead() {
  const commitFromEnv = process.env.GRAFANA_COMMIT?.trim();
  if (commitFromEnv) {
    return commitFromEnv;
  }
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

module.exports = {
  hooks: {
    beforePacking(pkg) {
      if (isPlainObject(pkg.exports)) {
        pkg.exports = stripSourceCondition(pkg.exports);
      }

      const gitHead = resolveGitHead();
      if (gitHead) {
        pkg.gitHead = gitHead;
      }

      return pkg;
    },
  },
};
