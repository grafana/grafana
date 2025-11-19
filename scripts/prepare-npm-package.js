//@ts-check
import PackageJson from '@npmcli/package-json';

const cwd = process.cwd();

try {
  const pkgJson = await PackageJson.load(cwd);
  const pkgJsonExports = pkgJson.content.exports ?? {};

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

  pkgJson.update({
    exports: pkgJsonExports,
  });

  await pkgJson.save();
} catch (e) {
  console.error(e);
  process.exit(1);
}
