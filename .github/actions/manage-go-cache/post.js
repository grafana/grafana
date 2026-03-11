const { execSync } = require("child_process");

function size(dir) {
  try {
    return execSync(`du -sh "${dir}" 2>/dev/null`).toString().trim().split("\t")[0];
  } catch {
    return "N/A";
  }
}

try {
  const gomodcache = execSync("go env GOMODCACHE").toString().trim();
  const gocache = execSync("go env GOCACHE").toString().trim();

  console.log("Before cleanup:");
  console.log(`  GOMODCACHE: ${size(gomodcache)} (${gomodcache})`);
  console.log(`  GOCACHE:    ${size(gocache)} (${gocache})`);

  // Remove cached test results before the cache-save post step runs.
  // Test results are not reusable across PRs and can account for a
  // large portion of GOCACHE. Compiled object files are kept.
  console.log("\nRunning go clean -testcache ...");
  execSync("go clean -testcache", { stdio: "inherit" });

  console.log("\nAfter cleanup:");
  console.log(`  GOMODCACHE: ${size(gomodcache)} (${gomodcache})`);
  console.log(`  GOCACHE:    ${size(gocache)} (${gocache})`);
} catch (e) {
  console.log("Could not clean/report Go cache sizes:", e.message);
}
