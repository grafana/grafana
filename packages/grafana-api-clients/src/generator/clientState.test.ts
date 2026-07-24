import fs from 'fs';
import os from 'os';
import path from 'path';

import { hasAPIConfigEntry, getExistingClientFiles, getClientGenerationState } from './clientState';
import { variantFor, PACKAGE_ROOT } from './variants';

describe('hasAPIConfigEntry', () => {
  let tmpDir: string;
  const variant = variantFor(false);

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-cs-'));
    // Create the codegen script file the function reads
    const scriptPath = path.join(tmpDir, variant.codegenScript);
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, `createAPIConfig('dashboard', 'v0alpha1')`);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns true when the config entry exists', () => {
    expect(hasAPIConfigEntry(tmpDir, variant, 'dashboard', 'v0alpha1')).toBe(true);
  });

  it('returns false when the config entry is absent', () => {
    expect(hasAPIConfigEntry(tmpDir, variant, 'folder', 'v1')).toBe(false);
  });
});

describe('getExistingClientFiles', () => {
  let tmpDir: string;
  const variant = variantFor(false);

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-cs-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns only the files that exist on disk', () => {
    // Create only baseAPI.ts
    const subpath = `${variant.clientBase}/dashboard/v0alpha1`;
    fs.mkdirSync(path.join(tmpDir, subpath), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, subpath, 'baseAPI.ts'), '');

    const result = getExistingClientFiles(tmpDir, variant, 'dashboard', 'v0alpha1');
    expect(result).toEqual([`${subpath}/baseAPI.ts`]);
  });

  it('returns an empty array when nothing exists', () => {
    expect(getExistingClientFiles(tmpDir, variant, 'dashboard', 'v0alpha1')).toEqual([]);
  });
});

describe('getClientGenerationState', () => {
  let tmpDir: string;
  const variant = variantFor(false);
  const input = { groupName: 'dashboard', version: 'v0alpha1', reducerPath: 'dashboardAPI' };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-cs-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports everything missing for a bare directory', () => {
    // Need codegen script to exist (even empty) so fileContains doesn't blow up
    const scriptPath = path.join(tmpDir, variant.codegenScript);
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, '');

    // Need the RTKQ index and package.json for isPackageClient checks
    const rtkqIndex = path.join(tmpDir, variant.clientBase, 'index.ts');
    fs.mkdirSync(path.dirname(rtkqIndex), { recursive: true });
    fs.writeFileSync(rtkqIndex, '');

    const pkgJsonPath = path.join(tmpDir, `${PACKAGE_ROOT}/package.json`);
    fs.mkdirSync(path.dirname(pkgJsonPath), { recursive: true });
    fs.writeFileSync(pkgJsonPath, JSON.stringify({ exports: {} }));

    const state = getClientGenerationState(tmpDir, variant, input);
    expect(state.isComplete).toBe(false);
    expect(state.missingParts.length).toBeGreaterThan(0);
    expect(state.hasConfigEntry).toBe(false);
    expect(state.hasBaseAPI).toBe(false);
    expect(state.hasIndex).toBe(false);
  });
});
