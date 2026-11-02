const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const prettier = require('prettier');
const ts = require('typescript');

const { createMigrationProgram, migrate } = require('./zod-mini.cjs');

const fixtureRoot = path.join(__dirname, '__fixtures__');
const options = {
  strict: true,
  skipLibCheck: true,
  types: [],
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  ignoreDeprecations: '6.0',
  noEmit: true,
};

function createProgram(files, root = fixtureRoot, resolveZod = true) {
  const contents = new Map(Object.entries(files).map(([name, text]) => [path.join(root, name), text]));
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile;
  const fileExists = host.fileExists;
  host.readFile = (file) => contents.get(file) ?? readFile(file);
  host.fileExists = (file) => contents.has(file) || fileExists(file);
  host.getSourceFile = (file, languageVersion) => {
    const text = host.readFile(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion, true);
  };
  host.directoryExists = (
    (original) => (directory) =>
      directory === root || original(directory)
  )(host.directoryExists);
  return resolveZod
    ? createMigrationProgram([...contents.keys()], options, host)
    : ts.createProgram([...contents.keys()], options, host);
}

function diagnostics(program) {
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file?.fileName}:${position?.line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;
  });
}

function transform(files) {
  const program = createProgram(files);
  assert.deepEqual(diagnostics(program), [], 'fixtures must type-check before migration');
  const changes = migrate(
    program,
    Object.keys(files).map((name) => path.join(fixtureRoot, name))
  );
  const output = Object.fromEntries(
    Object.entries(files).map(([name, text]) => [name, changes.get(path.join(fixtureRoot, name)) ?? text])
  );
  assert.deepEqual(diagnostics(createProgram(output)), [], 'migrated fixtures must type-check');
  return output;
}

function evaluate(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: options });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require });
  return exports;
}

test('rewrites nested chains in one pass, preserves comments and leaves unrelated methods alone', async () => {
  const input = `// Keep this license.
import * as z from 'zod';
// Keep this explanation.
export const schema = z.object({
  // Keep the property comment.
  values: z.array(z.string().optional().catch('fallback')).optional().default([]),
  title: z.string().describe('Title').optional(),
}).strict();
export const unrelated = ' hello '.trim().startsWith('hello');
export type Result = z.infer<typeof schema>;
`;
  const { 'schema.ts': output } = transform({ 'schema.ts': input });
  const format = (text) => prettier.format(text, { parser: 'typescript', singleQuote: true });
  assert.equal(
    await format(output),
    await format(`// Keep this license.
import * as z from 'zod/mini';
// Keep this explanation.
export const schema = z.strictObject({
  // Keep the property comment.
  values: z._default(z.array(z.catch(z.optional(z.string()), 'fallback')), []),
  title: z.optional(z.string().check(z.describe('Title'))),
});
export const unrelated = ' hello '.trim().startsWith('hello');
export type Result = z.infer<typeof schema>;
`)
  );
  const exports = evaluate(output);
  const parsed = exports.schema.parse({ values: [undefined, 5] });
  assert.equal(parsed.values[0], undefined);
  assert.equal(parsed.values[1], 'fallback');
});

test('preserves numeric versus length bounds, defaults, transforms and JSON Schema descriptions', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({
  count: z.number().int().min(0).max(10).optional().default(2),
  title: z.string().trim().min(2).max(8).describe('A title'),
  names: z.preprocess(value => value == null ? [] : value, z.array(z.string()).max(2)),
  upper: z.string().transform(value => value.toUpperCase()).optional(),
});
export const json = z.toJSONSchema(schema, { unrepresentable: 'any' });
`,
  });
  const { schema, json } = evaluate(output);
  assert.deepEqual(JSON.parse(JSON.stringify(schema.parse({ title: '  Hello  ', names: null, upper: 'up' }))), {
    count: 2,
    title: 'Hello',
    names: [],
    upper: 'UP',
  });
  assert.equal(schema.safeParse({ count: -1, title: 'Hello', names: [] }).success, false);
  assert.equal(schema.safeParse({ count: 1.5, title: 'Hello', names: [] }).success, false);
  assert.equal(schema.safeParse({ title: 'H', names: [] }).success, false);
  assert.equal(schema.safeParse({ title: 'Hello', names: ['a', 'b', 'c'] }).success, false);
  assert.equal(json.properties.title.description, 'A title');
  assert.equal(json.properties.title.minLength, 2);
  assert.equal(json.properties.count.minimum, 0);
  assert.equal(json.properties.names.type, 'array');
  assert.equal(json.properties.names.items.type, 'string');
});

test('preserves inline comments and updates API documentation without rewriting template strings', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
/** A z.ZodType using .optional().default(...). */
export const schema = z.string() /* Keep this reason. */ .optional().default(/* Keep this default. */ 'yes');
export const example = \`value \${1} // z.ZodType and z.preprocess\`;
`,
  });
  assert.match(output, /\/\* Keep this reason\. \*\//);
  assert.match(output, /\/\* Keep this default\. \*\//);
  assert.match(output, /\/\*\* A z\.ZodMiniType using z\._default\(schema, \.\.\.\)\. \*\//);
  assert.match(output, /`value \$\{1\} \/\/ z\.ZodType and z\.preprocess`/);
});

test('migrates imported schemas and metadata consumers without depending on file order', () => {
  const output = transform({
    'consumer.ts': `import type * as z from 'zod';
import { schema } from './schema';
export const description = schema.description;
export const patch = schema.partial();
export type Schema = z.ZodType;
`,
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({ name: z.string() }).describe('A name');
`,
    'noImport.ts': `import { schema } from './schema';
export const description = schema.description;
`,
    'noNamespace.ts': `import { schema } from './schema';
export const patch = schema.partial();
`,
  });
  assert.match(output['consumer.ts'], /import \* as z from 'zod\/mini'/);
  assert.match(output['consumer.ts'], /z\.globalRegistry\.get\(schema\)\?\.description/);
  assert.match(output['consumer.ts'], /z\.partial\(schema\)/);
  assert.match(output['consumer.ts'], /z\.ZodMiniType/);
  assert.match(output['noImport.ts'], /import \* as z from 'zod\/mini'/);
  assert.match(output['noNamespace.ts'], /z\.partial\(schema\)/);
});

test('keeps type-only imports unless a functional schema operation needs a value import', () => {
  const output = transform({
    'types.ts': `import type * as z from 'zod';
export type Schema = z.ZodType<string>;
export type AnySchema = z.ZodTypeAny;
export type Context = z.RefinementCtx;
`,
    'schema.ts': `import type * as z from 'zod';
import { schema } from './value';
export const patch = schema.extend({ other: schema.shape.name.optional() });
export type Result = z.infer<typeof patch>;
`,
    'value.ts': `import * as z from 'zod';
export const schema = z.object({ name: z.string() });`,
  });
  assert.match(output['types.ts'], /import type \* as z from 'zod\/mini'/);
  assert.match(output['types.ts'], /z\.core\.\$RefinementCtx/);
  assert.match(output['schema.ts'], /import \* as z from 'zod\/mini'/);
});

for (const entry of ['zod', 'zod/mini']) {
  test(`migrates imported schema refinements outside Grafana using ${entry}`, () => {
    const root = path.resolve(__dirname, '../../../__zod_mini_external_fixtures__');
    const files = {
      'rules.ts': `import type * as z from '${entry}';
import { schema } from './schema';
export const customSchema = schema.superRefine((form, ctx) => {
  if (form.host && !form.user) {
    ctx.addIssue({ code: 'custom', path: ['user'], message: 'A custom host needs a user' });
  }
});
`,
      'schema.ts': `import * as z from '${entry}';
export const schema = z.object({ host: z.string(), user: z.string() });
`,
    };
    const fileNames = Object.keys(files).map((name) => path.join(root, name));
    const changes = migrate(createProgram(files, root), fileNames);
    const output = Object.fromEntries(
      Object.entries(files).map(([name, text]) => [name, changes.get(path.join(root, name)) ?? text])
    );

    assert.match(output['rules.ts'], /import \* as z from 'zod\/mini'/);
    assert.match(output['rules.ts'], /schema\.check\(z\.superRefine\(/);
    assert.deepEqual(diagnostics(createProgram(output, root)), [], 'external migrated files must type-check');
  });
}

test('aborts instead of only rewriting imports when Zod cannot be resolved', () => {
  const root = path.resolve(__dirname, '../../../__zod_mini_external_fixtures__');
  const program = createProgram(
    { 'schema.ts': "import * as z from 'zod';\nexport const schema = z.string().optional();\n" },
    root,
    false
  );
  assert.throws(() => migrate(program, [path.join(root, 'schema.ts')]), /Cannot resolve Zod/);
});

test('omits optional immediately inside a default while retaining other optional behavior', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({
  name: z.string().optional().default('guest'),
  names: z.array(z.string()).optional().default(() => []),
  nullable: z.string().nullable().optional().default('fallback'),
  optional: z.string().default('inner').optional(),
  refined: z.string().optional().refine(value => value !== 'bad').default('good'),
});
export const missing: z.input<typeof schema> = {};
export const required: string = schema.parse({}).name;
export const optional: string | undefined = schema.parse({}).optional;
`,
  });
  assert.match(output, /name: z\._default\(z\.string\(\), 'guest'\)/);
  assert.match(output, /names: z\._default\(z\.array\(z\.string\(\)\), \(\) => \[\]\)/);
  assert.match(output, /nullable: z\._default\(z\.nullable\(z\.string\(\)\), 'fallback'\)/);
  assert.match(output, /optional: z\.optional\(z\._default\(z\.string\(\), 'inner'\)\)/);
  assert.match(output, /z\._default\(z\.optional\(z\.string\(\)\)\.check\(z\.refine/);
  const { schema } = evaluate(output);
  assert.deepEqual(JSON.parse(JSON.stringify(schema.parse({}))), {
    name: 'guest',
    names: [],
    nullable: 'fallback',
    optional: 'inner',
    refined: 'good',
  });
  assert.equal(schema.parse({ name: undefined }).name, 'guest');
  assert.equal(schema.parse({ name: 'Alice', nullable: null }).name, 'Alice');
  assert.equal(schema.parse({ nullable: null }).nullable, null);
  assert.equal(schema.safeParse({ name: 1 }).success, false);
  assert.equal(schema.safeParse({ refined: 'bad' }).success, false);
  assert.notEqual(schema.parse({}).names, schema.parse({}).names);
});

test('combines consecutive generated checks in order without crossing wrappers or transforms', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({
  name: z.string().trim() /* Keep the length reason. */ .min(2, 'Too short').max(5).describe('Name'),
  count: z.number().int().min(0).max(10),
  optional: z.string().min(2).optional().refine(value => value !== 'bad'),
  transformed: z.string().min(2).transform(value => value.length).refine(value => value >= 3),
});
`,
  });
  assert.match(output, /z\.trim\(\),[\s\S]*z\.minLength\(2,\s*'Too short'\), z\.maxLength\(5\), z\.describe\('Name'\)/);
  assert.match(output, /\/\* Keep the length reason\. \*\//);
  assert.match(output, /z\.number\(\)\.check\(z\.int\(\), z\.minimum\(0\), z\.maximum\(10\)\)/);
  assert.match(output, /z\.optional\(z\.string\(\)\.check\(z\.minLength\(2\)\)\)\.check\(z\.refine/);
  assert.match(output, /z\.pipe\(z\.string\(\)\.check\(z\.minLength\(2\)\), z\.transform/);
  const { schema } = evaluate(output);
  assert.deepEqual(JSON.parse(JSON.stringify(schema.parse({ name: '  Ada  ', count: 2, transformed: 'abc' }))), {
    name: 'Ada',
    count: 2,
    transformed: 3,
  });
  assert.equal(schema.safeParse({ name: ' A ', count: 2, transformed: 'abc' }).error.issues[0].message, 'Too short');
  assert.equal(schema.safeParse({ name: 'Ada', count: 1.5, transformed: 'abc' }).success, false);
  assert.equal(schema.safeParse({ name: 'Ada', count: 11, transformed: 'abc' }).success, false);
  assert.equal(schema.safeParse({ name: 'Ada', count: 2, transformed: 'ab' }).success, false);
  const z = require('zod/mini');
  assert.equal(z.globalRegistry.get(schema.shape.name).description, 'Name');
});

test('combines existing Mini check calls but leaves unrelated check methods alone', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod/mini';
export const schema = z.string().check(z.trim()).check(z.minLength(2), z.maxLength(5));
const unrelated = { check() { return this; } };
export const other = unrelated.check().check();
`,
  });
  assert.match(output, /z\.string\(\)\.check\(z\.trim\(\), z\.minLength\(2\),\s*z\.maxLength\(5\)\)/);
  assert.match(output, /unrelated\.check\(\)\.check\(\)/);
  assert.equal(evaluate(output).schema.parse(' Ada '), 'Ada');
});

test('migrates exact-length checks and object catchall schemas', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({
  title: z.string().length(3),
  suggestions: z.array(z.string()).length(0),
}).catchall(z.object({ attempt: z.string().optional() }));
`,
  });
  assert.match(output, /title: z\.string\(\)\.check\(z\.length\(3\)\)/);
  assert.match(output, /suggestions: z\.array\(z\.string\(\)\)\.check\(z\.length\(0\)\)/);
  assert.match(output, /z\.catchall\(z\.object\(\{[\s\S]*\}\), z\.object\(/);
  const { schema } = evaluate(output);
  assert.deepEqual(
    JSON.parse(JSON.stringify(schema.parse({ title: 'abc', suggestions: [], extra: { attempt: 'done' } }))),
    {
      title: 'abc',
      suggestions: [],
      extra: { attempt: 'done' },
    }
  );
  assert.equal(schema.safeParse({ title: 'ab', suggestions: [] }).success, false);
  assert.equal(schema.safeParse({ title: 'abc', suggestions: ['unexpected'] }).success, false);
  assert.equal(schema.safeParse({ title: 'abc', suggestions: [], extra: 1 }).success, false);
});

test('migrates schema JSON conversion, including consumers without a Zod import', () => {
  const output = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({ name: z.string().describe('A name') });
export const json = schema.toJSONSchema({ target: 'draft-07' });
`,
    'generate.ts': `import { schema } from './schema';
export const json = schema.toJSONSchema({ target: 'draft-07' });
const unrelated = { toJSONSchema: () => 'unchanged' };
export const other = unrelated.toJSONSchema();
`,
  });
  assert.match(output['generate.ts'], /import \* as z from 'zod\/mini'/);
  assert.match(output['generate.ts'], /z\.toJSONSchema\(schema, \{ target: 'draft-07' \}\)/);
  assert.match(output['generate.ts'], /unrelated\.toJSONSchema\(\)/);
  assert.deepEqual(evaluate(output['schema.ts']).json, {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: { name: { type: 'string', description: 'A name' } },
    required: ['name'],
    additionalProperties: false,
  });
});

test('places added Zod imports after Node builtins in build scripts', () => {
  const output = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.string();
`,
    'generate.ts': `/// <reference types="node" />
import * as fs from 'node:fs';

import { schema } from './schema';
export const json = schema.toJSONSchema();
export const read = fs.readFileSync;
`,
  });
  assert.match(output['generate.ts'], /import \* as fs from 'node:fs';\nimport \* as z from 'zod\/mini';\n\n/);
});

test('constrains generic object shape members and preserves inferred object keys', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
const create = <T>(color: T) => z.object({ color, text: z.object({ primary: z.string().optional() }) }).partial();
export const schema = create(z.string());
export type Theme = Required<z.infer<ReturnType<typeof create>>>;
export const theme: Theme = { color: 'red', text: { primary: 'black' } };
export const primary = theme.text!.primary;
`,
  });
  assert.match(output, /<T extends z\.ZodMiniType>/);
  assert.match(output, /z\.partial\(z\.object/);
});

test('migrates raw shape constraints while preserving inferred object fields', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as schema from 'zod';
export type Shape = schema.ZodRawShape;
function build<P extends schema.ZodRawShape, S extends Shape>(panel: P, section: S) {
  return schema.object({ panels: schema.array(schema.object(panel)), section: schema.object(section) });
}
export const plan = build({ title: schema.string() }, { id: schema.number() });
export const parsed: { panels: Array<{ title: string }>; section: { id: number } } =
  plan.parse({ panels: [{ title: 'CPU' }], section: { id: 1 } });
`,
  });
  assert.match(output, /schema\.core\.\$ZodShape/);
  assert.deepEqual(JSON.parse(JSON.stringify(evaluate(output).parsed)), {
    panels: [{ title: 'CPU' }],
    section: { id: 1 },
  });
});

test('preserves narrowing refinements and their custom error messages', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
type Choice = 'yes' | 'no';
function isChoice(value: unknown): value is Choice { return value === 'yes' || value === 'no'; }
export const schema = z.string().refine(isChoice, { error: 'Choose yes or no' });
export const choice: Choice = schema.parse('yes');
`,
  });
  const { schema, choice } = evaluate(output);
  assert.equal(choice, 'yes');
  assert.equal(schema.safeParse('other').error.issues[0].message, 'Choose yes or no');
  assert.equal(schema.safeParse(1).error.issues[0].code, 'invalid_type');
});

test('names an imported refinement type without expanding its union into generated code', () => {
  const output = transform({
    'choices.ts': `export type Choice = 'yes' | 'no';
export function isChoice(value: unknown): value is Choice { return value === 'yes' || value === 'no'; }`,
    'schema.ts': `import * as z from 'zod';
import { isChoice } from './choices';
export const schema = z.string().refine(isChoice).optional();
export const choice: import('./choices').Choice | undefined = schema.parse('yes');
`,
  });
  assert.match(output['schema.ts'], /import \{ isChoice, type Choice \} from '\.\/choices'/);
  assert.match(output['schema.ts'], /z\.custom<Choice>\(isChoice\)/);
});

test('rewrites superRefine issues while preserving paths and unrelated namespaces', () => {
  const { 'schema.ts': output } = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({ value: z.number() }).superRefine((data, ctx) => {
  if (data.value < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Negative' });
});
export function unrelated(z: { string(): { optional(): number } }) { return z.string().optional(); }
`,
  });
  const { schema } = evaluate(output);
  assert.deepEqual(JSON.parse(JSON.stringify(schema.safeParse({ value: -1 }).error.issues)), [
    { code: 'custom', path: ['value'], message: 'Negative' },
  ]);
  assert.match(output, /return z\.string\(\)\.optional\(\)/);
});

test('fails explicitly for unsupported APIs instead of returning a partial migration', () => {
  const files = {
    'schema.ts': `import * as z from 'zod'; export const schema = z.string().email();`,
  };
  const program = createProgram(files);
  assert.throws(
    () => migrate(program, [path.join(fixtureRoot, 'schema.ts')]),
    /migration aborted without writing files:[\s\S]*Unsupported Zod method email/
  );
});

test('rejects a shadowed namespace instead of generating calls to an unrelated local', () => {
  const files = {
    'schema.ts': `import * as z from 'zod';
const schema = z.string();
export function wrap(z: number) { return schema.optional(); }`,
  };
  assert.throws(
    () => migrate(createProgram(files), [path.join(fixtureRoot, 'schema.ts')]),
    /Zod namespace because z is shadowed here/
  );
});

test('is a no-op on a second run', () => {
  const files = transform({
    'schema.ts': `import * as z from 'zod';
export const schema = z.object({ name: z.string().optional().default('World') }).describe('Greeting');`,
  });
  const program = createProgram(files);
  assert.equal(migrate(program, [path.join(fixtureRoot, 'schema.ts')]).size, 0);
});
