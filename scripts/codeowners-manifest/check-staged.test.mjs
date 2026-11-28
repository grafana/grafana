import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { parseCodeownersPatterns } = require('./check-staged.js');
const scriptPath = fileURLToPath(new URL('./check-staged.js', import.meta.url));

const BASE_CODEOWNERS = [
  '# comment',
  '',
  '/.github/CODEOWNERS @org/team',
  '/.gitignore @org/team',
  '/owned/ @org/team',
  '',
].join('\n');

/**
 * Creates a throwaway git repo with one commit, so only later staged changes are checked
 */
function createRepo(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'codeowners-check-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args],
      { cwd: dir, stdio: 'pipe' }
    );

  const write = (relativePath, content = 'x\n') => {
    const file = path.join(dir, relativePath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  git('init', '-q');
  write('.github/CODEOWNERS', BASE_CODEOWNERS);
  write('.gitignore', '/generated/\n');
  write('owned/a.txt');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');

  const run = () => spawnSync(process.execPath, [scriptPath], { cwd: dir, encoding: 'utf8' });

  return { git, write, run };
}

test('parseCodeownersPatterns returns only the pattern of each entry', () => {
  const content = [
    '# Lines starting with # are comments',
    '',
    '/docs/ @org/docs',
    '*.go   @org/backend @someone',
    '/with\\ space/file.txt @org/team',
    '   /indented/ @org/team   ',
    '',
  ].join('\n');

  assert.deepEqual(parseCodeownersPatterns(content), ['/docs/', '*.go', '/with\\ space/file.txt', '/indented/']);
});

test('passes when a new file matches a CODEOWNERS pattern', (t) => {
  const repo = createRepo(t);
  repo.write('owned/b.txt');
  repo.git('add', 'owned/b.txt');

  assert.equal(repo.run().status, 0);
});

test('fails and lists a new file without an owner', (t) => {
  const repo = createRepo(t);
  repo.write('unowned/b.txt');
  repo.git('add', 'unowned/b.txt');

  const result = repo.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unowned\/b\.txt/);
});

test('passes when the file and its owner are added in the same commit', (t) => {
  const repo = createRepo(t);
  repo.write('unowned/b.txt');
  repo.write('.github/CODEOWNERS', `${BASE_CODEOWNERS}/unowned/ @org/team\n`);
  repo.git('add', 'unowned/b.txt', '.github/CODEOWNERS');

  assert.equal(repo.run().status, 0);
});

test('fails when a file is renamed to a path without an owner', (t) => {
  const repo = createRepo(t);
  repo.git('mv', 'owned/a.txt', 'elsewhere.txt');

  const result = repo.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /elsewhere\.txt/);
});

test('fails when a CODEOWNERS change leaves an existing file without an owner', (t) => {
  const repo = createRepo(t);
  repo.write('.github/CODEOWNERS', BASE_CODEOWNERS.replace('/owned/ @org/team\n', ''));
  repo.git('add', '.github/CODEOWNERS');

  const result = repo.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /owned\/a\.txt/);
});

test('ignores modified and deleted files', (t) => {
  const repo = createRepo(t);
  repo.write('.gitignore', '/generated/\n/other/\n');
  repo.git('add', '.gitignore');
  assert.equal(repo.run().status, 0);

  repo.git('rm', '-q', 'owned/a.txt');
  assert.equal(repo.run().status, 0);
});

test('does not require owners for tracked files that .gitignore ignores, like CI', (t) => {
  const repo = createRepo(t);
  repo.write('generated/out.txt');
  repo.git('add', '-f', 'generated/out.txt');

  assert.equal(repo.run().status, 0);
});
