import Handlebars from 'handlebars';

// Handlebars.compile evaluates generated code, which a CSP without 'unsafe-eval' blocks. This
// compiles the AST to closures instead, matching the Handlebars 4.7 runtime with default options.

type Environment = typeof Handlebars;
type Data = Record<string, unknown>;

interface ProgramOptions {
  data?: Data;
  blockParams?: unknown[];
}

/** `options.fn` and `options.inverse`. */
type Program = (context: unknown, options?: ProgramOptions) => string;

interface Scope {
  context: unknown;
  data: Data;
  /** Entered contexts, innermost first. Only kept when a path uses `../`. */
  depths: unknown[];
  /** Block param values, innermost first. Only kept when a block declares any. */
  blockParams: Array<unknown[] | undefined>;
}

/** Declared block param names, aligned with `Scope.blockParams`. */
type DeclaredBlockParams = Array<string[] | undefined>;

type Expression = (scope: Scope) => unknown;
type Statement = (scope: Scope) => string;
type ProgramFactory = (scope: Scope) => Program;

interface HelperOptions {
  name: string;
  hash: Data;
  data: Data;
  loc: hbs.AST.SourceLocation;
  lookupProperty: typeof lookupProperty;
  fn?: Program;
  inverse?: Program;
}

// Called as helpers even without arguments.
const KNOWN_HELPERS = new Set(['helperMissing', 'blockHelperMissing', 'each', 'if', 'unless', 'with', 'log', 'lookup']);

// Hooks, not callable by name.
const HOOKS = new Set(['helperMissing', 'blockHelperMissing']);

const noop: Program = () => '';

/** Own properties only. A prototype's own `constructor` is denied, as it reaches `Function`. */
function lookupProperty(parent: unknown, propertyName: unknown): unknown {
  const name =
    typeof propertyName === 'string' || typeof propertyName === 'symbol' ? propertyName : String(propertyName);
  const result: unknown = Reflect.get(Object(parent), name);

  if (result == null) {
    return result;
  }

  const isPrototypeConstructor = name === 'constructor' && typeof result === 'function' && parent === result.prototype;

  return Object.prototype.hasOwnProperty.call(parent, name) && !isPrototypeConstructor ? result : undefined;
}

export function interpret(program: hbs.AST.Program, env: Environment): (context: unknown) => string {
  // `this` for helpers when there is no context.
  const nullContext = Object.seal({});

  // Set while compiling, read while rendering.
  const uses = { depths: false, blockParams: false };

  const findHelper = (name: string): unknown => (HOOKS.has(name) ? undefined : lookupProperty(env.helpers, name));

  const callContext = (scope: Scope): unknown => (scope.context != null ? scope.context : nullContext);

  // A block keeping its context, like `#if`, adds no depth for `../`.
  function enter(depths: unknown[], context: unknown): unknown[] {
    const current = depths[0];
    const same = context === current || (context == null && current == null);

    return same || (context === nullContext && current === null) ? depths : [context, ...depths];
  }

  function createOptions(
    scope: Scope,
    name: string,
    hash: Data,
    loc: hbs.AST.SourceLocation,
    fn?: ProgramFactory,
    inverse?: ProgramFactory
  ): HelperOptions {
    const options: HelperOptions = { name, hash, data: scope.data, loc, lookupProperty };

    // Helpers check `options.fn` to detect a block call.
    if (fn || inverse) {
      options.fn = fn ? fn(scope) : noop;
      options.inverse = inverse ? inverse(scope) : noop;
    }

    return options;
  }

  function compilePath(path: hbs.AST.PathExpression, falsy: boolean, declared: DeclaredBlockParams): Expression {
    const { parts, depth } = path;
    const [name] = parts;

    if (depth) {
      uses.depths = true;
    }

    const blockParam = !depth && !isScoped(path) ? indexBlockParam(declared, name) : undefined;

    if (blockParam) {
      const [frame, index] = blockParam;
      return (scope) => walk(scope.blockParams[frame]?.[index], parts, 1, false);
    }

    if (!name) {
      return depth ? (scope) => scope.depths[depth] : (scope) => scope.context;
    }

    if (path.data) {
      return (scope) => walk(dataAt(scope.data, depth), parts, 0, true);
    }

    return depth
      ? (scope) => walk(scope.depths[depth], parts, 0, falsy)
      : (scope) => walk(scope.context, parts, 0, falsy);
  }

  function compileParam(node: hbs.AST.Expression, declared: DeclaredBlockParams): Expression {
    if (isPath(node)) {
      return compilePath(node, false, declared);
    }
    if (isSubExpression(node)) {
      return compileCall(node, declared);
    }
    if (isLiteral(node)) {
      const { value } = node;
      return () => value;
    }
    if (node.type === 'NullLiteral') {
      return () => null;
    }
    if (node.type === 'UndefinedLiteral') {
      return () => undefined;
    }

    throw new Handlebars.Exception(`Unknown type: ${node.type}`, node);
  }

  function compileHash(hash: hbs.AST.Hash | undefined, declared: DeclaredBlockParams): (scope: Scope) => Data {
    const pairs = (hash?.pairs ?? []).map((pair) => ({ key: pair.key, value: compileParam(pair.value, declared) }));

    return (scope) => {
      // Null prototype, so `__proto__=` can't replace it.
      const values: Data = Object.create(null);

      for (const { key, value } of pairs) {
        values[key] = value(scope);
      }

      return values;
    };
  }

  // By shape: a helper call with arguments, a lookup for `a.b` or `this.a`, and
  // a bare `{{name}}` is decided at runtime.
  function compileCall(
    node: hbs.AST.MustacheStatement | hbs.AST.SubExpression | hbs.AST.BlockStatement,
    declared: DeclaredBlockParams,
    fn?: ProgramFactory,
    inverse?: ProgramFactory
  ): Expression {
    const block = node.type === 'BlockStatement';
    const path = toPath(node.path);
    const [name] = path.parts;
    const simple = isSimpleId(path);
    const blockParam = simple && indexBlockParam(declared, name) !== undefined;
    const hasArguments = node.type === 'SubExpression' || node.params.length > 0 || Boolean(node.hash);
    const { loc } = node;

    if (!blockParam && (hasArguments || (simple && KNOWN_HELPERS.has(name)))) {
      const params = node.params.map((param) => compileParam(param, declared));
      const hash = compileHash(node.hash, declared);

      // Matched on the first part, so `{{this.if a}}` calls `if`.
      if (KNOWN_HELPERS.has(name)) {
        return (scope) => {
          const args = params.map((param) => param(scope));
          args.push(createOptions(scope, name, hash(scope), loc, fn, inverse));
          return call(findHelper(name), name, callContext(scope), args);
        };
      }

      const lookup = compilePath(path, true, declared);

      return (scope) => {
        const args = params.map((param) => param(scope));
        args.push(createOptions(scope, path.original, hash(scope), loc, fn, inverse));
        const helper = (simple ? findHelper(name) : undefined) || lookup(scope) || env.helpers.helperMissing;
        return call(helper, path.original, callContext(scope), args);
      };
    }

    const lookup = compilePath(path, false, declared);

    if (!blockParam && simple) {
      return (scope) => {
        const helper = findHelper(name);
        const found = helper || lookup(scope);
        const target = found != null ? found : env.helpers.helperMissing;

        // Plain fields need no options.
        if (!block && typeof target !== 'function') {
          return target;
        }

        const options = createOptions(scope, name, Object.create(null), loc, fn, inverse);
        const value = typeof target === 'function' ? Reflect.apply(target, callContext(scope), [options]) : target;

        return block && !helper ? callHook(scope.context, [value, options]) : value;
      };
    }

    if (!block) {
      return (scope) => lambda(lookup(scope), scope.context);
    }

    return (scope) => {
      const value = lambda(lookup(scope), scope.context);
      return callHook(scope.context, [
        value,
        createOptions(scope, path.original, Object.create(null), loc, fn, inverse),
      ]);
    };
  }

  function callHook(thisArg: unknown, args: unknown[]): unknown {
    return call(env.helpers.blockHelperMissing, 'blockHelperMissing', thisArg, args);
  }

  function compileProgram(
    program: hbs.AST.Program | undefined,
    declared: DeclaredBlockParams
  ): ProgramFactory | undefined {
    if (!program) {
      return undefined;
    }

    if (program.blockParams?.length) {
      uses.blockParams = true;
    }

    const body = compileBody(program, [program.blockParams, ...declared]);

    return (scope) =>
      (context, options = {}) =>
        body({
          context,
          data: options.data || scope.data,
          depths: uses.depths ? enter(scope.depths, context) : scope.depths,
          blockParams: uses.blockParams ? [options.blockParams, ...scope.blockParams] : scope.blockParams,
        });
  }

  function compileStatement(node: hbs.AST.Statement, declared: DeclaredBlockParams): Statement {
    if (isContent(node)) {
      const { value } = node;
      return () => value;
    }

    if (node.type === 'CommentStatement') {
      return () => '';
    }

    if (isMustache(node)) {
      const expression = compileCall(node, declared);
      return node.escaped ? (scope) => escapeValue(expression(scope)) : (scope) => toOutput(expression(scope));
    }

    if (isBlock(node)) {
      const fn = compileProgram(node.program, declared);
      const inverse = compileProgram(node.inverse, declared);
      const expression = compileCall(node, declared, fn, inverse);
      return (scope) => toOutput(expression(scope));
    }

    // Partials and decorators: none registered.
    throw new Handlebars.Exception(`Unsupported Handlebars expression: ${node.type}`, node);
  }

  function compileBody(program: hbs.AST.Program, declared: DeclaredBlockParams): Statement {
    const statements = program.body.map((statement) => compileStatement(statement, declared));

    return (scope) => {
      let output = '';

      for (const statement of statements) {
        output += statement(scope);
      }

      return output;
    };
  }

  // The root's empty frame keeps the stacks aligned.
  const body = compileBody(program, [program.blockParams]);

  return (context) => body({ context, data: { root: context }, depths: [context], blockParams: [undefined] });
}

/** [frame, index] of a declared block param. */
function indexBlockParam(declared: DeclaredBlockParams, name: string | undefined): [number, number] | undefined {
  if (name === undefined) {
    return undefined;
  }

  for (let frame = 0; frame < declared.length; frame++) {
    const index = declared[frame]?.indexOf(name) ?? -1;
    if (index >= 0) {
      return [frame, index];
    }
  }

  return undefined;
}

// Helper paths stop at falsy values, other paths at null and undefined.
function walk(value: unknown, parts: string[], start: number, falsy: boolean): unknown {
  let current = value;

  for (let i = start; i < parts.length; i++) {
    if (falsy ? !current : current == null) {
      return current;
    }
    current = lookupProperty(current, parts[i]);
  }

  return current;
}

function dataAt(data: Data, depth: number): unknown {
  let current: unknown = data;

  for (let i = depth; current && i > 0; i--) {
    current = lookupProperty(current, '_parent');
  }

  return current;
}

function call(helper: unknown, name: string, thisArg: unknown, args: unknown[]): unknown {
  if (typeof helper !== 'function') {
    throw new Handlebars.Exception(`Missing helper: "${name}"`);
  }

  return Reflect.apply(helper, thisArg, args);
}

function lambda(value: unknown, context: unknown): unknown {
  return typeof value === 'function' ? Reflect.apply(value, context, []) : value;
}

// Concatenation, like compiled templates, so objects stringify the same.
function toOutput(value: unknown): string {
  return value != null ? '' + value : '';
}

// Typed for strings, but handles any value, including SafeString.
function escapeValue(value: unknown): string {
  return Reflect.apply(Handlebars.Utils.escapeExpression, undefined, [value]);
}

function isScoped(path: hbs.AST.PathExpression): boolean {
  return /^\.|this\b/.test(path.original);
}

function isSimpleId(path: hbs.AST.PathExpression): boolean {
  return path.parts.length === 1 && !isScoped(path) && !path.depth;
}

// `{{"name"}}` and `{{true}}` are looked up as paths.
function toPath(node: hbs.AST.PathExpression | hbs.AST.Literal): hbs.AST.PathExpression {
  if (isPath(node)) {
    return node;
  }

  const original = isLiteral(node) ? String(node.original) : node.type === 'NullLiteral' ? 'null' : 'undefined';

  return { type: 'PathExpression', data: false, depth: 0, parts: [original], original, loc: node.loc };
}

function isPath(node: hbs.AST.Node): node is hbs.AST.PathExpression {
  return node.type === 'PathExpression';
}

function isSubExpression(node: hbs.AST.Node): node is hbs.AST.SubExpression {
  return node.type === 'SubExpression';
}

function isLiteral(node: hbs.AST.Node): node is hbs.AST.StringLiteral | hbs.AST.NumberLiteral | hbs.AST.BooleanLiteral {
  return node.type === 'StringLiteral' || node.type === 'NumberLiteral' || node.type === 'BooleanLiteral';
}

function isContent(node: hbs.AST.Node): node is hbs.AST.ContentStatement {
  return node.type === 'ContentStatement';
}

function isMustache(node: hbs.AST.Node): node is hbs.AST.MustacheStatement {
  return node.type === 'MustacheStatement';
}

function isBlock(node: hbs.AST.Node): node is hbs.AST.BlockStatement {
  return node.type === 'BlockStatement';
}
