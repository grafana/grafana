//
// Semver utils: parse, compare, sort etc (using official regexp)
// https://regex101.com/r/Ly7O1x/3/
//
const semverRegExp =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function semverParse(tag) {
  const m = tag.match(semverRegExp);
  if (!m) {
    return;
  }
  const [_, major, minor, patch, prerelease, build] = m;
  return [+major, +minor, +patch, prerelease, build, tag];
};

// semverCompare takes two parsed semver tags and comparest them more or less
// according to the semver specs
export function semverCompare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] < b[i] ? 1 : -1;
    }
  }
  if (a[3] !== b[3]) {
    return a[3] < b[3] ? 1 : -1;
  }
  return 0;
};


// Finds the highest version that is lower than the target version.
//
// This function relies on the following invariant: versions are sorted by the release date.
// It will produce wrong result if invariant doesn't hold.
export const findPreviousVersion = (versionByDate, target) => {
  let prev = null;

  for (let i = 0; i < versionByDate.length; i++) {
    const version = versionByDate[i];

    // version is greater than the target
    if (semverCompare(target, version) > 0) {
      continue;
    }

    // we came across the target version, all versions seen previously have greater release date.
    if (semverCompare(target, version) === 0 && target[4] === version[4]) {
      prev = null;
      continue;
    }

    if (prev == null) {
      prev = version;
      continue;
    }

    if (semverCompare(prev, version) > 0) {
      prev = version;
    }
  }

  return prev;
};


const versionsByDate = [
  "v10.4.19", "v12.0.1", "v11.6.2", "v11.5.5", "v11.4.5", "v11.3.7", "v11.2.10", "v12.0.0+security-01", "v11.2.9+security-01", "v11.3.6+security-01",
  "v11.6.1+security-01", "v11.4.4+security-01", "v11.5.4+security-01", "v10.4.18+security-01", "v12.0.0", "v11.6.1",
  "v11.5.4", "v11.4.4", "v11.3.6", "v11.2.9", "v10.4.18", "v11.6.0+security-01", "v11.5.3+security-01", "v11.4.3+security-01",
  "v11.3.5+security-01", "v11.2.8+security-01", "v10.4.17+security-01", "v11.2.8", "v11.6.0", "v11.5.2", "v11.4.2",
  "v11.3.4", "v11.2.7", "v11.1.12", "v11.0.11", "v10.4.16", "v11.5.1", "v11.5.0", "v11.3.3", "v11.1.11", "v11.2.6",
  "v11.0.10", "v10.4.15", "v11.4.1", "v11.4.0", "v11.3.2", "v11.2.5", "v11.1.10", "v11.0.9", "v10.4.14", "v11.3.1",
  "v11.2.4", "v11.1.9", "v11.0.8", "v10.4.13", "v11.0.2", "v10.4.6", "v10.3.8", "v10.2.9", "v11.1.0", "v11.0.1",
  "v10.4.5", "v10.3.7", "v10.2.8", "v9.5.20", "v10.4.4", "v9.5.19", "v10.1.10", "v10.2.7", "v10.3.6", "v10.4.3",
  "v11.0.0", "v10.4.2", "v11.0.0-preview", "v10.1.9", "v10.0.13", "v9.2.0", "v9.1.8",
].map(semverParse);

function test(version, expected) {
  const v1 = semverParse(version);
  const prev = findPreviousVersion(versionsByDate, v1);

  const failureMessage = `FAIILED. Expected ${expected}, but was ${prev[5]}`;

  console.log(`Test ${version}, ${prev[5] === expected ? 'PASSED' : failureMessage}`);
}

test("v11.5.4+security-01", "v11.5.4");
test("v11.5.4", "v11.5.3+security-01");
test("v12.0.0", "v11.6.1");
test("v12.0.0+security-01", "v12.0.0");
test("v11.0.0", "v11.0.0-preview");
