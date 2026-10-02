import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// testdata/spec holds the documents `grafana cli write-openapi` renders for the manifest of
// github.com/grafana/grafana-app-sdk-testing-plugin (a kind with a status subresource and custom
// routes, plus the settings version every app plugin serves). Regenerate with:
//   grafana cli write-openapi dist/app-sdk-manifest.json -o <grafana>/packages/grafana-api-clients/src/cli/testdata/spec
const specDir = path.join(__dirname, 'testdata/spec');
const goldenDir = path.join(__dirname, 'testdata/generated');

// @rtk-query/codegen-openapi loads prettier through a dynamic import(), which jest's CommonJS runtime
// does not support, so the CLI runs as a child process the way a plugin would run it.
function generate(outDir: string) {
  execFileSync(
    process.execPath,
    ['--conditions=@grafana-app/source', path.join(__dirname, 'generate.ts'), 'generate', '--spec', specDir, '--out', outDir],
    {
      stdio: 'pipe',
    }
  );
}

function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) {
      const full = path.join(entry.parentPath, entry.name);
      out[path.relative(dir, full)] = readFileSync(full, 'utf8');
    }
  }
  return out;
}

describe('generateClients', () => {
  let outDir: string;
  beforeAll(() => {
    outDir = mkdtempSync(path.join(tmpdir(), 'api-clients-'));
    generate(outDir);
  });
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('writes one client per served version', () => {
    expect(readdirSync(outDir).sort()).toEqual(['v0alpha1', 'v1alpha1']);
    expect(readdirSync(path.join(outDir, 'v1alpha1')).sort()).toEqual(['baseAPI.ts', 'endpoints.gen.ts', 'index.ts']);
  });

  it('matches the golden output', () => {
    const got = readTree(outDir);
    if (process.env.UPDATE_GOLDEN) {
      rmSync(goldenDir, { recursive: true, force: true });
      for (const [file, content] of Object.entries(got)) {
        const target = path.join(goldenDir, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
    }
    expect(got).toEqual(readTree(goldenDir));
  });

  it('generates hooks for the kind, its custom route, and the settings API', () => {
    const v1 = readFileSync(path.join(outDir, 'v1alpha1/endpoints.gen.ts'), 'utf8');
    for (const hook of [
      'useListTestResourceQuery',
      'useCreateTestResourceMutation',
      'useGetTestResourceQuery',
      'useReplaceTestResourceMutation',
      'useDeleteTestResourceMutation',
      'useUpdateTestResourceMutation',
      'useGetTestResourceStatusQuery',
      'useGetBarQuery',
      'useGetFooQuery',
    ]) {
      expect(v1).toContain(hook);
    }
    expect(v1).toMatch(/import \{ api \} from ["']\.\/baseAPI["']/);
    // per-kind search is filtered out, as for the clients in this package
    expect(v1).not.toMatch(/testresources\/search/);

    const v0 = readFileSync(path.join(outDir, 'v0alpha1/endpoints.gen.ts'), 'utf8');
    expect(v0).toContain('useGetSettingsQuery');
    expect(v0).toContain('useGetApiResourcesQuery');
  });

  it('does not overwrite baseAPI.ts or index.ts on rerun', () => {
    const baseAPI = path.join(outDir, 'v1alpha1/baseAPI.ts');
    writeFileSync(baseAPI, '// edited\n');
    generate(outDir);
    expect(readFileSync(baseAPI, 'utf8')).toBe('// edited\n');
  });
});
