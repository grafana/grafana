import Handlebars from 'handlebars';

import { RenderMode, type TextMode } from '../panelcfg.gen';

import { compileProgram } from './handlebars';
import { isScoped, isSimpleId, KNOWN_HELPERS } from './handlebarsInterpreter';
import { escapeCommentedTemplates, interpretsHandlebars } from './renderContent';

export type FmtReadReason = 'namespace' | 'helper' | 'expression' | 'row' | 'shadowed' | 'name';

interface FmtRead {
  from: number;
  to: number;
  line: number;
  reason: FmtReadReason;
}

export interface FmtReads {
  convertible: number;
  unconverted: FmtRead[];
}

interface FmtChange {
  from: number;
  to: number;
  line: number;
  text: string;
}

export interface FmtMigration {
  content: string;
  changes: FmtChange[];
  unconverted: FmtRead[];
}

export interface FmtMigrationOptions {
  mode: TextMode;
  renderMode?: RenderMode;
  hasFmtField: boolean;
}

const NAMESPACE = 'fmt';
const HELPER = 'display';

const ROW = 1;
const ROWS = 2;
const ROOT = 4;
const FRAMES = 8;
const FRAME = 16;
const OBJECT = 32;
const SCALAR = 64;
const NOTHING = 128;
const UNKNOWN = 256;

const DATA_SCALARS = new Set(['index', 'key', 'first', 'last']);
const KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'this']);
const IDENTIFIER = /^[A-Za-z_$][\w$-]*$/;
const LINE_BREAK = /\r\n?|\n/g;
const LINE_SEPARATORS = /[\u2028\u2029]/g;
const SEPARATOR_STAND_IN = '\u2001';

interface Scope {
  context: number;
  depths: number[];
  params: Array<Map<string, number> | undefined>;
}

interface Row {
  data: boolean;
  depth: number;
  parts: string[];
  scoped: boolean;
}

interface Replacement {
  name: string;
  row?: Row;
}

interface Edit extends Replacement {
  from: number;
  to: number;
  line: number;
  text: string;
}

type Position = 'statement' | 'param' | 'callee';

interface Read {
  index: number;
  base: number;
  stopsAtFalsy: boolean;
}

const ROOT_PARTIAL_SCOPE: Scope = { context: NOTHING, depths: [], params: [] };

export function findFmtReads(content: string, options: FmtMigrationOptions): FmtReads {
  const analysis = analyzeContent(content, options);

  return { convertible: analysis?.edits.length ?? 0, unconverted: analysis?.unconverted ?? [] };
}

export function migrateFmt(content: string, options: FmtMigrationOptions): FmtMigration {
  const analysis = analyzeContent(content, options);

  if (!analysis || analysis.edits.length === 0) {
    return { content, changes: [], unconverted: analysis?.unconverted ?? [] };
  }

  const { source, program, edits, unconverted, replacements, toContent } = analysis;
  const changes = edits.map(({ from, to, line, text }) => ({ from: toContent(from), to: toContent(to), line, text }));
  const converted = applyEdits(source, edits);
  const migrated = applyEdits(content, changes);

  if (
    escapeCommentedTemplates(migrated) !== converted ||
    !matches(program, parseTemplate(replaceLineSeparators(converted)), replacements)
  ) {
    const failed = changes.map(({ from, to, line }): FmtRead => ({ from, to, line, reason: 'expression' }));
    return { content, changes: [], unconverted: [...unconverted, ...failed].sort((a, b) => a.from - b.from) };
  }

  return { content: migrated, changes, unconverted };
}

function analyzeContent(content: string, { mode, renderMode, hasFmtField }: FmtMigrationOptions) {
  if (!interpretsHandlebars(mode) || !content.includes(NAMESPACE)) {
    return undefined;
  }

  const source = escapeCommentedTemplates(content);
  const program = parseCompilable(replaceLineSeparators(source));

  if (!program) {
    return undefined;
  }

  const root = renderMode === RenderMode.PerRow ? ROW | ROOT : ROOT;
  const { edits, unconverted, replacements } = analyze(program, root, hasFmtField, source);
  const toContent = mapToContentOffsets(content, source);

  return {
    source,
    program,
    edits,
    replacements,
    toContent,
    unconverted: unconverted.map((read) => ({ ...read, from: toContent(read.from), to: toContent(read.to) })),
  };
}

function parseCompilable(source: string): hbs.AST.Program | undefined {
  const program = parseTemplate(source);

  try {
    return program && compileProgram(program, (value) => value) ? program : undefined;
  } catch {
    return undefined;
  }
}

function parseTemplate(source: string): hbs.AST.Program | undefined {
  try {
    return Handlebars.parse(source);
  } catch {
    return undefined;
  }
}

function analyze(program: hbs.AST.Program, root: number, shadowed: boolean, source: string) {
  const edits: Edit[] = [];
  const unconverted: FmtRead[] = [];
  const replacements = new Map<object, Replacement>();
  const lineStarts = getLineStarts(source);
  const offsetOf = ({ line, column }: hbs.AST.Position) => (lineStarts[line - 1] ?? source.length) + column;
  const rangeOf = (node: hbs.AST.Node) => ({
    from: offsetOf(node.loc.start),
    to: offsetOf(node.loc.end),
    line: node.loc.start.line,
  });

  const findParam = (scope: Scope, name: string) => {
    for (const params of scope.params) {
      const value = params?.get(name);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  };

  function resolveHelper(path: hbs.AST.PathExpression, scope: Scope, hasArgs: boolean): string | undefined {
    const [name] = path.parts;
    const simple = isSimpleId(path);

    if (name === undefined || (simple && findParam(scope, name) !== undefined)) {
      return undefined;
    }
    if (KNOWN_HELPERS.has(name) && (hasArgs || simple)) {
      return name;
    }
    return simple ? name : undefined;
  }

  function getReason(
    read: Read,
    name: string,
    row: ReturnType<typeof getRowArgument>,
    position: Position,
    chained: boolean,
    scope: Scope
  ): FmtReadReason | undefined {
    if (findParam(scope, HELPER) !== undefined) {
      return 'helper';
    }
    if (chained || position === 'callee') {
      return 'expression';
    }
    if (read.base & UNKNOWN || (read.stopsAtFalsy && read.base & SCALAR)) {
      return 'row';
    }
    if (read.base & ROW && shadowed) {
      return 'shadowed';
    }
    if (!isWritableName(name) || name === '__proto__' || (row && row.text === undefined)) {
      return 'name';
    }
    return undefined;
  }

  function record(
    path: hbs.AST.PathExpression,
    read: Read,
    scope: Scope,
    position: Position,
    statement?: hbs.AST.MustacheStatement
  ) {
    const name = path.parts[read.index + 1];
    const row = getRowArgument(path, read.index);
    const chained = read.index + 2 < path.parts.length;
    const reason = name === undefined ? 'namespace' : getReason(read, name, row, position, chained, scope);

    if (name === undefined || reason) {
      unconverted.push({ ...rangeOf(path), reason: reason ?? 'namespace' });
      return;
    }

    const call = `${HELPER} ${quote(name)}${row ? ` row=${row.text}` : ''}`;
    const replacement: Replacement = { name, row: row?.row };
    edits.push({ ...rangeOf(path), ...replacement, text: position === 'statement' ? call : `(${call})` });
    replacements.set(statement ?? path, replacement);
  }

  function walk(path: hbs.AST.PathExpression, scope: Scope): { value: number; read?: Read } {
    const { parts, depth, data } = path;
    const [first] = parts;
    const param = !depth && !isScoped(path) && first !== undefined ? findParam(scope, first) : undefined;
    let value: number;
    let start = 1;
    let stopsAtFalsy = false;

    if (param !== undefined) {
      value = param;
    } else if (first !== undefined && data) {
      value = first === 'root' ? root | (depth ? NOTHING : 0) : DATA_SCALARS.has(first) ? SCALAR | NOTHING : UNKNOWN;
      stopsAtFalsy = true;
    } else {
      value = depth ? unionOf(scope.depths.slice(depth)) : scope.context;
      start = 0;
    }

    for (let index = start; index < parts.length; index++) {
      if (parts[index] === NAMESPACE) {
        return { value: UNKNOWN, read: { index, base: value, stopsAtFalsy } };
      }
      value = propertyKind(value, parts[index], shadowed);
    }

    return { value };
  }

  function resolve(
    path: hbs.AST.PathExpression,
    scope: Scope,
    position: Position,
    statement?: hbs.AST.MustacheStatement
  ): number {
    const { value, read } = walk(path, scope);

    if (read) {
      record(path, read, scope, position, statement);
    }

    return value;
  }

  function evaluate(node: hbs.AST.Expression, scope: Scope): number {
    if (isPath(node)) {
      return resolve(node, scope, 'param');
    }
    if (isSubExpression(node)) {
      return call(node, scope);
    }
    if (node.type === 'NullLiteral' || node.type === 'UndefinedLiteral') {
      return NOTHING;
    }
    return SCALAR;
  }

  function args(node: { params: hbs.AST.Expression[]; hash?: hbs.AST.Hash }, scope: Scope): number[] {
    const values = node.params.map((param) => evaluate(param, scope));
    node.hash?.pairs.forEach((pair) => evaluate(pair.value, scope));
    return values;
  }

  function call(node: hbs.AST.SubExpression | hbs.AST.MustacheStatement, scope: Scope): number {
    const path = isPath(node.path) ? node.path : undefined;
    const helper = path ? resolveHelper(path, scope, true) : undefined;

    if (path) {
      resolve(path, scope, 'callee');
    }

    const values = args(node, scope);

    if (helper === 'lookup') {
      const [, key] = node.params;
      const name = key && isLiteralKey(key) ? String(key.value) : undefined;
      if (name === NAMESPACE && values[0] & (ROW | UNKNOWN)) {
        unconverted.push({ ...rangeOf(node), reason: 'namespace' });
      }
      return propertyKind(values[0] ?? NOTHING, name, shadowed);
    }

    if (helper === 'split' || helper === 'variable') {
      return OBJECT;
    }

    return helper === HELPER && node.params.length > 0 ? SCALAR | NOTHING : UNKNOWN;
  }

  function mustache(node: hbs.AST.MustacheStatement, scope: Scope) {
    if (!isPath(node.path)) {
      args(node, scope);
    } else if (node.params.length > 0 || node.hash) {
      call(node, scope);
    } else {
      resolve(node.path, scope, 'statement', node);
    }
  }

  function block(node: hbs.AST.BlockStatement, scope: Scope) {
    const path = isPath(node.path) ? node.path : undefined;
    const helper = path ? resolveHelper(path, scope, node.params.length > 0 || Boolean(node.hash)) : undefined;
    if (path) {
      resolve(path, scope, 'callee');
    }

    const values = args(node, scope);
    const [value = NOTHING] = values;

    if (helper === 'each') {
      const item = itemKind(value);
      enter(node.program, scope, item, true, [item, SCALAR]);
    } else if (helper === 'with') {
      enter(node.program, scope, value, true, [value]);
    } else if (helper === 'if' || helper === 'unless') {
      enter(node.program, scope, scope.context, false, []);
    } else if (helper === HELPER && values.length > 0) {
      const display = values.length === 1 ? OBJECT : SCALAR;
      enter(node.program, scope, display, true, [display]);
    } else {
      enter(node.program, scope, UNKNOWN, true, [UNKNOWN, UNKNOWN]);
    }

    enter(node.inverse, scope, scope.context, false, []);
  }

  function enter(program: hbs.AST.Program | undefined, scope: Scope, context: number, push: boolean, values: number[]) {
    if (!program) {
      return;
    }

    const names = program.blockParams;
    const params = names?.length ? new Map(names.map((name, index) => [name, values[index] ?? NOTHING])) : undefined;
    const entersNullContext = !push && Boolean(scope.context & (NOTHING | UNKNOWN));
    const current = entersNullContext ? (scope.context & ~NOTHING) | OBJECT : context;
    const entered: Scope = {
      context: current,
      depths: push || entersNullContext ? [current, ...scope.depths] : scope.depths,
      params: [params, ...scope.params],
    };

    body(program, entered, entered);
  }

  function body(program: hbs.AST.Program, scope: Scope, definition: Scope) {
    for (const node of program.body) {
      if (isMustache(node)) {
        mustache(node, scope);
      } else if (isBlock(node)) {
        block(node, scope);
      } else if (isInlinePartial(node)) {
        const partial: Scope = {
          context: UNKNOWN,
          depths: [UNKNOWN, ...definition.depths],
          params: [undefined, ...definition.params],
        };
        body(node.program, partial, partial);
      } else if (isPartial(node)) {
        args(node, scope);
      }
    }
  }

  body(program, { context: root, depths: [root], params: [undefined] }, ROOT_PARTIAL_SCOPE);

  edits.sort((a, b) => a.from - b.from);
  unconverted.sort((a, b) => a.from - b.from);

  return { edits, unconverted, replacements };
}

function getRowArgument(path: hbs.AST.PathExpression, index: number): { text?: string; row: Row } | undefined {
  const { data, depth } = path;
  const parts = path.parts.slice(0, index);

  if (!data && depth === 0 && parts.length === 0) {
    return undefined;
  }

  const scoped = !data && depth === 0 && isScoped(path);
  const row: Row = { data, depth, parts, scoped };
  const segments = parts.map(toPathSegment);

  if (segments.some((segment) => segment === undefined)) {
    return { row };
  }

  const parents = Array(depth).fill('..').join('/');
  const names = [...(scoped ? ['this'] : []), ...segments].join('.');

  return { text: `${data ? '@' : ''}${parents}${parents && names ? '/' : ''}${names}`, row };
}

function toPathSegment(part: string): string | undefined {
  if (IDENTIFIER.test(part) && !KEYWORDS.has(part)) {
    return part;
  }

  return isWritableName(part) ? `[${part.replace(/\\/g, '\\\\').replace(/]/g, '\\]')}]` : undefined;
}

function isWritableName(name: string): boolean {
  return !name.endsWith('\\') && !name.includes(SEPARATOR_STAND_IN);
}

function quote(name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
}

function replaceLineSeparators(source: string): string {
  return source.replace(LINE_SEPARATORS, SEPARATOR_STAND_IN);
}

function propertyKind(value: number, name: string | undefined, shadowed: boolean): number {
  const isIndex = name === undefined || /^\d+$/.test(name);
  const isLength = name === undefined || name === 'length';
  let result = 0;

  if (value & ROW) {
    result |= name === NAMESPACE && !shadowed ? OBJECT : UNKNOWN;
  }
  if (value & ROWS) {
    result |= (isIndex ? ROW | NOTHING : 0) | (isLength ? SCALAR : NOTHING);
  }
  if (value & FRAMES) {
    result |= (isIndex ? FRAME | NOTHING : 0) | (isLength ? SCALAR : NOTHING);
  }
  if (value & ROOT) {
    result |=
      name === 'data' ? ROWS : name === 'frames' ? FRAMES : name === undefined ? ROWS | FRAMES | NOTHING : NOTHING;
  }
  if (value & FRAME) {
    result |= name === 'data' ? ROWS : name === undefined ? ROWS | SCALAR | NOTHING : SCALAR | NOTHING;
  }
  if (value & (OBJECT | SCALAR | NOTHING)) {
    result |= SCALAR | NOTHING;
  }
  if (value & UNKNOWN) {
    result |= UNKNOWN;
  }

  return result;
}

function itemKind(value: number): number {
  let result = 0;

  if (value & ROWS) {
    result |= ROW;
  }
  if (value & FRAMES) {
    result |= FRAME;
  }
  if (value & ROOT) {
    result |= ROWS | FRAMES;
  }
  if (value & FRAME) {
    result |= ROWS | SCALAR | NOTHING;
  }
  if (value & OBJECT) {
    result |= SCALAR | NOTHING;
  }
  if (value & (ROW | UNKNOWN)) {
    result |= UNKNOWN;
  }

  return result;
}

function unionOf(values: number[]): number {
  return values.length ? values.reduce((all, value) => all | value, 0) : NOTHING;
}

function matches(original: unknown, converted: unknown, replacements: Map<object, Replacement>): boolean {
  if (original === converted) {
    return true;
  }
  if (!isRecord(original) || !isRecord(converted)) {
    return false;
  }

  const replacement = replacements.get(original);
  if (replacement) {
    return isReplacement(original, converted, replacement);
  }

  if (Array.isArray(original)) {
    return (
      Array.isArray(converted) &&
      original.length === converted.length &&
      original.every((item, index) => matches(item, converted[index], replacements))
    );
  }

  const keys = Object.keys(original).filter((key) => key !== 'loc');

  return (
    keys.length === Object.keys(converted).filter((key) => key !== 'loc').length &&
    keys.every((key) => key in converted && matches(original[key], converted[key], replacements))
  );
}

function isReplacement(
  original: Record<string, unknown>,
  converted: Record<string, unknown>,
  replacement: Replacement
): boolean {
  if (original.type === 'MustacheStatement') {
    return (
      converted.type === 'MustacheStatement' &&
      converted.escaped === original.escaped &&
      matches(original.strip, converted.strip, new Map()) &&
      isDisplayCall(converted, replacement)
    );
  }

  return converted.type === 'SubExpression' && isDisplayCall(converted, replacement);
}

function isDisplayCall({ path, params, hash }: Record<string, unknown>, { name, row }: Replacement): boolean {
  const [param, ...rest] = Array.isArray(params) ? params : [];
  const pairs = isRecord(hash) && Array.isArray(hash.pairs) ? hash.pairs : [];
  const [pair] = pairs;
  const value = pairs.length === 1 && isRecord(pair) && pair.key === 'row' ? pair.value : undefined;

  const isHelper = isPathNode(path) && !path.data && path.depth === 0 && path.original === HELPER;
  const isName = rest.length === 0 && isRecord(param) && param.type === 'StringLiteral' && param.value === name;

  if (!row) {
    return isHelper && isName && hash === undefined;
  }

  return (
    isHelper &&
    isName &&
    isPathNode(value) &&
    value.data === row.data &&
    value.depth === row.depth &&
    matches(row.parts, value.parts, new Map()) &&
    (row.data || row.depth > 0 || isScoped(value) === row.scoped)
  );
}

function applyEdits(text: string, edits: Array<{ from: number; to: number; text: string }>): string {
  let result = '';
  let position = 0;

  for (const edit of edits) {
    result += text.slice(position, edit.from) + edit.text;
    position = edit.to;
  }

  return result + text.slice(position);
}

function getLineStarts(source: string): number[] {
  const starts = [0];

  for (const match of source.matchAll(LINE_BREAK)) {
    starts.push(match.index + match[0].length);
  }

  return starts;
}

function mapToContentOffsets(content: string, source: string): (offset: number) => number {
  if (content === source) {
    return (offset) => offset;
  }

  const offsets = new Array<number>(source.length + 1);
  let position = 0;

  for (let index = 0; index < source.length; index++) {
    offsets[index] = position;
    if (source[index] === content[position]) {
      position++;
    }
  }
  offsets[source.length] = position;

  return (offset) => offsets[offset] ?? content.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPathNode(value: unknown): value is hbs.AST.PathExpression {
  return isRecord(value) && value.type === 'PathExpression' && typeof value.original === 'string';
}

function isPath(node: hbs.AST.Node): node is hbs.AST.PathExpression {
  return node.type === 'PathExpression';
}

function isSubExpression(node: hbs.AST.Node): node is hbs.AST.SubExpression {
  return node.type === 'SubExpression';
}

function isLiteralKey(node: hbs.AST.Node): node is hbs.AST.StringLiteral | hbs.AST.NumberLiteral {
  return node.type === 'StringLiteral' || node.type === 'NumberLiteral';
}

function isMustache(node: hbs.AST.Node): node is hbs.AST.MustacheStatement {
  return node.type === 'MustacheStatement';
}

function isBlock(node: hbs.AST.Node): node is hbs.AST.BlockStatement {
  return node.type === 'BlockStatement';
}

function isInlinePartial(node: hbs.AST.Node): node is hbs.AST.DecoratorBlock {
  return node.type === 'DecoratorBlock';
}

function isPartial(node: hbs.AST.Node): node is hbs.AST.PartialStatement {
  return node.type === 'PartialStatement';
}
