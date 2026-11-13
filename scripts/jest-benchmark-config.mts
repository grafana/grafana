import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface BenchmarkRoster {
  include: string[];
  exclude: string[];
  groups: string[][];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label}: unknown key ${JSON.stringify(key)}`);
    }
  }
}

function validateShard(shard: string) {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(shard);
  if (
    match?.[0] !== shard ||
    !Number.isSafeInteger(Number(match[1])) ||
    !Number.isSafeInteger(Number(match[2])) ||
    Number(match[1]) > Number(match[2])
  ) {
    throw new Error(`Invalid shard ${JSON.stringify(shard)}: expected N/M with positive safe integers and N <= M`);
  }
}

function relativePath(value: unknown, label: string): string {
  if (
    typeof value !== 'string' || !value.trim() || /[\\\0]/.test(value) ||
    path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[a-z]:/i.test(value) ||
    value.split('/').includes('..') || value.startsWith('!')
  ) {
    throw new Error(`${label} must be a nonempty root-relative path or pattern without backslashes, '..', or negation`);
  }
  return value;
}

function filePath(value: unknown, label: string): string {
  const file = relativePath(value, label);
  if (/[*?\[\]{}()!]/.test(file) || file.endsWith('/') || path.posix.normalize(file) === '.') {
    throw new Error(`${label} must be a root-relative file path, not a glob or directory`);
  }
  return file;
}

function patterns(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value.map((entry, index) => relativePath(entry, `${label}[${index}]`));
}

function rules(value: unknown, label: string): BenchmarkRoster {
  const source = object(value, label);
  keys(source, ['include', 'exclude', 'groups'], label);
  const include = 'include' in source ? patterns(source.include, `${label}.include`) : [];
  const exclude = 'exclude' in source ? patterns(source.exclude, `${label}.exclude`) : [];
  const groups: string[][] = [];
  if ('groups' in source) {
    if (!Array.isArray(source.groups)) {
      throw new Error(`${label}.groups must be an array`);
    }
    for (const [index, group] of source.groups.entries()) {
      const members = patterns(group, `${label}.groups[${index}]`);
      if (members.length < 2) {
        throw new Error(`${label}.groups[${index}] must have at least two patterns`);
      }
      groups.push(members);
    }
  }
  return { include, exclude, groups };
}

export async function loadBenchmarkConfig(rootDir: string, environment: 'jsdom' | 'happy-dom', shard: string) {
  validateShard(shard);
  if (environment !== 'jsdom' && environment !== 'happy-dom') {
    throw new Error(`Invalid environment ${JSON.stringify(environment)}`);
  }
  const result = {
    jestConfig: 'jest.config.js',
    testEnvironment: environment === 'jsdom' ? 'jsdom' : '',
    roster: { include: [], exclude: [], groups: [] } as BenchmarkRoster,
    files: [] as Array<{ path: string; sha256: string }>,
  };
  for (const name of ['jest.benchmark.json', `jest.benchmark.${environment}.json`]) {
    let bytes: Buffer;
    try {
      bytes = await readFile(path.resolve(rootDir, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    try {
      const config = object(JSON.parse(bytes.toString('utf8')), name);
      keys(config, ['version', 'jestConfig', 'testEnvironment', 'include', 'exclude', 'groups', 'shards'], name);
      if (config.version !== 1) {
        throw new Error('version must be 1');
      }
      if ('jestConfig' in config) {
        result.jestConfig = filePath(config.jestConfig, 'jestConfig');
      }
      if ('testEnvironment' in config) {
        const env = config.testEnvironment;
        if (typeof env === 'string' && env.startsWith('./')) {
          result.testEnvironment = filePath(env, 'testEnvironment');
        } else if (typeof env === 'string' && /^(?:@[a-z0-9_-][a-z0-9._-]*\/)?[a-z0-9_-][a-z0-9._-]*$/i.test(env)) {
          result.testEnvironment = env;
        } else {
          throw new Error('testEnvironment must be a package name or a ./root-relative file path');
        }
      }
      const topRules = Object.fromEntries(Object.entries(config).filter(([key]) => ['include', 'exclude', 'groups'].includes(key)));
      const layers = [rules(topRules, name)];
      if ('shards' in config) {
        for (const [key, value] of Object.entries(object(config.shards, 'shards'))) {
          validateShard(key);
          const layer = rules(value, `shards[${JSON.stringify(key)}]`);
          if (key === shard) {
            layers.push(layer);
          }
        }
      }
      for (const layer of layers) {
        result.roster.include.push(...layer.include);
        result.roster.exclude.push(...layer.exclude);
        result.roster.groups.push(...layer.groups);
      }
      result.files.push({ path: name, sha256: createHash('sha256').update(bytes).digest('hex') });
    } catch (error) {
      throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  if (!result.testEnvironment) {
    throw new Error('Happy DOM is not configured in this checkout. Set testEnvironment in jest.benchmark.happy-dom.json.');
  }
  return result;
}

export function applyRoster(rootDir: string, selected: string[], candidates: string[], roster: BenchmarkRoster) {
  const root = path.resolve(rootDir);
  const relative = (file: string) => path.relative(root, file).split(path.sep).join('/');
  const absolute = (file: string) => {
    const resolved = path.resolve(root, file);
    relativePath(relative(resolved), 'Suite path');
    if (!path.isAbsolute(file) && (file.includes('\\') || /^[a-z]:/i.test(file))) {
      throw new Error(`Invalid suite path ${JSON.stringify(file)}`);
    }
    return resolved;
  };
  const { include, exclude, groups } = rules(roster, 'roster');
  const original = new Set(selected.map(absolute));
  const files = new Set(original);
  const eligible = [...new Set(candidates.map(absolute))];
  const matches = (file: string, pattern: string) => path.posix.matchesGlob(relative(file), path.posix.normalize(pattern));
  const expand = (pattern: string) => {
    const found = eligible.filter((file) => matches(file, pattern));
    if (!found.length) {
      throw new Error(`Roster pattern ${JSON.stringify(pattern)} matches no eligible Jest suites`);
    }
    return found;
  };
  for (const pattern of include) {
    for (const file of expand(pattern)) {
      files.add(file);
    }
  }
  const expandedGroups = groups.map((group) => group.flatMap(expand));
  // Overlapping groups can activate one another, regardless of their order in the JSON file.
  let changed: boolean;
  do {
    changed = false;
    for (const group of expandedGroups) {
      if (group.some((file) => files.has(file))) {
        for (const file of group) {
          if (!files.has(file)) {
            files.add(file);
            changed = true;
          }
        }
      }
    }
  } while (changed);
  for (const file of files) {
    if (exclude.some((pattern) => matches(file, pattern))) {
      files.delete(file);
    }
  }
  return {
    files: [...files].sort(),
    added: [...files].filter((file) => !original.has(file)).sort(),
    excluded: [...original].filter((file) => !files.has(file)).sort(),
  };
}
