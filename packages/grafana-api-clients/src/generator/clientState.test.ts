import fs from 'fs';
import os from 'os';
import path from 'path';

import { hasAPIConfigEntry, getExistingClientFiles, getClientGenerationState } from './clientState';
import { registerRTKClient } from './files';
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

  describe('registered package client', () => {
    const populatedImport = "import { generatedAPI as dashboardAPI } from './dashboard/v0alpha1';";
    const baseImport = "import { api as dashboardAPI } from './dashboard/v0alpha1/baseAPI';";
    const reducer = '[dashboardAPI.reducerPath]: dashboardAPI.reducer,';
    const middleware = 'dashboardAPI.middleware,';

    beforeEach(() => {
      const clientDir = path.join(tmpDir, variant.clientBase, 'dashboard/v0alpha1');
      fs.mkdirSync(clientDir, { recursive: true });
      fs.writeFileSync(path.join(clientDir, 'baseAPI.ts'), '');
      fs.writeFileSync(path.join(clientDir, 'index.ts'), '');
      const scriptPath = path.join(tmpDir, variant.codegenScript);
      fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
      fs.writeFileSync(scriptPath, "createAPIConfig('dashboard', 'v0alpha1')");
      fs.writeFileSync(
        path.join(tmpDir, PACKAGE_ROOT, 'package.json'),
        JSON.stringify({ exports: { './rtkq/dashboard/v0alpha1': {} } })
      );
      for (const [fileName, importEntry] of [
        ['index.ts', populatedImport],
        ['registration.ts', baseImport],
      ]) {
        fs.writeFileSync(
          path.join(tmpDir, variant.clientBase, fileName),
          `${importEntry}\n// GENERATED:IMPORT\n${reducer}\n// GENERATED:REDUCER\n${middleware}\n// GENERATED:MIDDLEWARE\n`
        );
      }
    });

    it('is complete when both populated and base registrations exist', () => {
      expect(getClientGenerationState(tmpDir, variant, input)).toMatchObject({
        hasRTKImport: true,
        hasRTKReducer: true,
        hasRTKMiddleware: true,
        hasRegistrationImport: true,
        hasRegistrationReducer: true,
        hasRegistrationMiddleware: true,
        missingParts: [],
        isComplete: true,
      });
    });

    it.each([
      ['index.ts', populatedImport, 'import'],
      ['index.ts', reducer, 'reducer'],
      ['index.ts', middleware, 'middleware'],
      ['registration.ts', baseImport, 'import'],
      ['registration.ts', reducer, 'reducer'],
      ['registration.ts', middleware, 'middleware'],
    ])('repairs a missing %s %s entry without duplicating other wiring', (fileName, entry, kind) => {
      const filePath = path.join(tmpDir, variant.clientBase, fileName);
      const completeContent = fs.readFileSync(filePath, 'utf8');
      fs.writeFileSync(filePath, completeContent.replace(`${entry}\n`, ''));
      expect(getClientGenerationState(tmpDir, variant, input)).toMatchObject({
        isComplete: false,
        missingParts: [`${variant.clientBase}/${fileName} ${kind}`],
      });

      registerRTKClient(tmpDir, variant, input);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(completeContent);
      expect(getClientGenerationState(tmpDir, variant, input).isComplete).toBe(true);
    });

    it('populates both marker files and leaves both unchanged on reruns', () => {
      const indexPath = path.join(tmpDir, variant.clientBase, 'index.ts');
      const registrationPath = path.join(tmpDir, variant.clientBase, 'registration.ts');
      const expectedIndex = fs.readFileSync(indexPath, 'utf8');
      const expectedRegistration = fs.readFileSync(registrationPath, 'utf8');
      for (const filePath of [indexPath, registrationPath]) {
        fs.writeFileSync(filePath, '// GENERATED:IMPORT\n// GENERATED:REDUCER\n// GENERATED:MIDDLEWARE\n');
      }

      registerRTKClient(tmpDir, variant, input);
      registerRTKClient(tmpDir, variant, input);

      expect(fs.readFileSync(indexPath, 'utf8')).toBe(expectedIndex);
      expect(fs.readFileSync(registrationPath, 'utf8')).toBe(expectedRegistration);
      expect(getClientGenerationState(tmpDir, variant, input).isComplete).toBe(true);
    });

    it('reports all registration entries missing when only the populated index exists', () => {
      fs.unlinkSync(path.join(tmpDir, variant.clientBase, 'registration.ts'));
      expect(getClientGenerationState(tmpDir, variant, input)).toMatchObject({
        hasRTKImport: true,
        hasRTKReducer: true,
        hasRTKMiddleware: true,
        isComplete: false,
        missingParts: [
          `${variant.clientBase}/registration.ts import`,
          `${variant.clientBase}/registration.ts reducer`,
          `${variant.clientBase}/registration.ts middleware`,
        ],
      });
    });

    it('requires base imports rather than populated imports in registration.ts', () => {
      const filePath = path.join(tmpDir, variant.clientBase, 'registration.ts');
      fs.writeFileSync(filePath, fs.readFileSync(filePath, 'utf8').replace(baseImport, populatedImport));
      expect(getClientGenerationState(tmpDir, variant, input)).toMatchObject({
        hasRegistrationImport: false,
        isComplete: false,
        missingParts: [`${variant.clientBase}/registration.ts import`],
      });
    });
  });

  it('keeps enterprise clients complete without package registrations', () => {
    const enterprise = variantFor(true);
    const clientDir = path.join(tmpDir, enterprise.clientBase, 'dashboard/v0alpha1');
    fs.mkdirSync(clientDir, { recursive: true });
    fs.writeFileSync(path.join(clientDir, 'baseAPI.ts'), '');
    fs.writeFileSync(path.join(clientDir, 'index.ts'), '');
    const scriptPath = path.join(tmpDir, enterprise.codegenScript);
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, "createAPIConfig('dashboard', 'v0alpha1')");

    registerRTKClient(tmpDir, enterprise, input);

    expect(getClientGenerationState(tmpDir, enterprise, input)).toMatchObject({
      missingParts: [],
      isComplete: true,
    });
    expect(fs.readdirSync(path.join(tmpDir, enterprise.clientBase))).toEqual(['dashboard']);
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
