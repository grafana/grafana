import fs from 'fs';
import os from 'os';
import path from 'path';

import { writeNewFileIfMissing, repoPathExists, fileContains, injectBeforeMarkerIfMissing } from './files';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-files-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeNewFileIfMissing', () => {
  it('creates the file and parent directories when absent', () => {
    const filePath = path.join(tmpDir, 'sub', 'new.ts');
    expect(writeNewFileIfMissing(filePath, 'hello')).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('hello');
  });

  it('returns false and does not overwrite an existing file', () => {
    const filePath = path.join(tmpDir, 'existing.ts');
    fs.writeFileSync(filePath, 'original');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    expect(writeNewFileIfMissing(filePath, 'replacement')).toBe(false);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('original');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('repoPathExists', () => {
  it('returns true when the resolved path exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), '');
    expect(repoPathExists(tmpDir, 'a.txt')).toBe(true);
  });

  it('returns false when the resolved path is missing', () => {
    expect(repoPathExists(tmpDir, 'missing.txt')).toBe(false);
  });
});

describe('fileContains', () => {
  it('returns true when the file contains the text', () => {
    const filePath = path.join(tmpDir, 'f.ts');
    fs.writeFileSync(filePath, 'import { foo } from "bar";');
    expect(fileContains(filePath, 'foo')).toBe(true);
  });

  it('returns false when the file does not contain the text', () => {
    const filePath = path.join(tmpDir, 'f.ts');
    fs.writeFileSync(filePath, 'import { foo } from "bar";');
    expect(fileContains(filePath, 'baz')).toBe(false);
  });

  it('returns false when the file does not exist', () => {
    expect(fileContains(path.join(tmpDir, 'nope'), 'any')).toBe(false);
  });
});

describe('injectBeforeMarkerIfMissing', () => {
  it('inserts text immediately before the marker line', () => {
    const filePath = path.join(tmpDir, 'config.ts');
    fs.writeFileSync(filePath, 'head\n// MARKER\ntail');
    expect(injectBeforeMarkerIfMissing(filePath, '// MARKER', 'NEW_LINE')).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('head\nNEW_LINE\n// MARKER\ntail');
  });

  it('returns false when the text already exists', () => {
    const filePath = path.join(tmpDir, 'config.ts');
    fs.writeFileSync(filePath, 'head\nNEW_LINE\n// MARKER\ntail');
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    expect(injectBeforeMarkerIfMissing(filePath, '// MARKER', 'NEW_LINE')).toBe(false);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('throws when the marker is missing from the file', () => {
    const filePath = path.join(tmpDir, 'config.ts');
    fs.writeFileSync(filePath, 'no marker here');
    expect(() => injectBeforeMarkerIfMissing(filePath, '// MARKER', 'x')).toThrow('Marker not found');
  });
});
