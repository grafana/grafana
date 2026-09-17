import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

import { dashboardV2SpecSchema } from './dashboardV2Schema';

// The gdev/dev dashboards, converted to the stable v2 spec by the Go conversion
// suite. The schema must accept every one of them.
//
// These `*.v2.json` files are generated golden output (git-ignored), written by
// `go test ./apps/dashboard/pkg/migration/conversion/...`. When they are absent
// (fresh checkout / frontend-only CI) the corpus check skips; the always-on
// coverage lives in `dashboardV2Schema.test.ts`.
const REPO_ROOT = resolve(__dirname, '../../../../..');
const GDEV_DIR = join(REPO_ROOT, 'apps/dashboard/pkg/migration/conversion/testdata/output/migrated_dev_dashboards');

function collectStableV2Fixtures(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectStableV2Fixtures(full));
    } else if (entry.name.endsWith('.v2.json')) {
      // Stable v2 only — skip v0alpha1/v1/v1beta1/v2alpha1/v2beta1 variants.
      out.push(full);
    }
  }
  return out;
}

const fixtures = existsSync(GDEV_DIR) ? collectStableV2Fixtures(GDEV_DIR) : [];

const describeCorpus = fixtures.length > 0 ? describe : describe.skip;

describeCorpus('dashboardV2SpecSchema — gdev/dev-dashboard corpus', () => {
  it('found the stable v2 gdev corpus', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures.map((f) => [f.slice(REPO_ROOT.length + 1), f] as const))('validates %s', (_relative, absolute) => {
    const envelope = JSON.parse(readFileSync(absolute, 'utf-8'));
    const result = dashboardV2SpecSchema.safeParse(envelope.spec);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('\n');
      throw new Error(`Spec failed v2 schema validation:\n${issues}`);
    }

    expect(result.success).toBe(true);
  });
});
