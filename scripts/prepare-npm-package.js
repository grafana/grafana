//@ts-check
import PackageJson from '@npmcli/package-json';
import { execSync } from 'node:child_process';

const cwd = process.cwd();

/**
 * Resolve the source commit to stamp as `gitHead`. npm records this automatically, but
 * only when publishing from a git working directory - we publish pre-packed tarballs,
 * so we set it here so published manifests carry the SHA they were built from. The
 * release workflow passes GRAFANA_COMMIT; otherwise fall back to the current HEAD.
 */
function resolveGitHead() {
  const fromEnv = process.env.GRAFANA_COMMIT?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

try {
  const pkgJson = await PackageJson.load(cwd);
  const pkgJsonExports = pkgJson.content.exports;

  /** @type {Record<string, unknown>} */
  const update = {};

  // skip packages without exports otherwise consumers cannot import anything from the package
  if (pkgJsonExports && typeof pkgJsonExports === 'object') {
    // Remove all exports that only contain a single key '@grafana-app/source'
    // as these will not resolve when validating packages with attw because the
    // source code is not available in the tarball.
    for (const [key, val] of Object.entries(pkgJsonExports)) {
      if (
        val !== null &&
        typeof val === 'object' &&
        Object.keys(val).length === 1 &&
        Object.keys(val)[0] === '@grafana-app/source'
      ) {
        delete pkgJsonExports[key];
      }
    }

    update.exports = pkgJsonExports;
  }

  const gitHead = resolveGitHead();
  if (gitHead) {
    update.gitHead = gitHead;
  }

  if (Object.keys(update).length > 0) {
    pkgJson.update(update);
    await pkgJson.save();
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
