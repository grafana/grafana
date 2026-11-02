/**
 * ```sh
 * # Preview the affected paths without writing files.
 * node --max-old-space-size=8192 scripts/codemods/zod-mini.cjs
 *
 * # Apply the migration and format the changed TypeScript files with Prettier.
 * node --max-old-space-size=8192 scripts/codemods/zod-mini.cjs --write
 *
 * # From the Grafana repo root, migrate Enterprise TypeScript files (zsh).
 * node --max-old-space-size=8192 scripts/codemods/zod-mini.cjs --write --files ../grafana-enterprise/src/public/**'/'*.ts ../grafana-enterprise/src/public/**'/'*.tsx
 *
 * # Test the codemod.
 * node --test scripts/codemods/zod-mini.test.cjs
 * ```
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const ts = require('typescript');

const wrappers = new Map([
  ['optional', 'optional'],
  ['nullable', 'nullable'],
  ['nullish', 'nullish'],
  ['default', '_default'],
  ['catch', 'catch'],
  ['array', 'array'],
  ['extend', 'extend'],
  ['partial', 'partial'],
  ['pick', 'pick'],
  ['omit', 'omit'],
  ['required', 'required'],
  ['pipe', 'pipe'],
  ['readonly', 'readonly'],
  ['nonoptional', 'nonoptional'],
  ['prefault', 'prefault'],
  ['catchall', 'catchall'],
]);
const checks = new Set([
  'describe',
  'refine',
  'superRefine',
  'positive',
  'negative',
  'nonnegative',
  'nonpositive',
  'int',
  'multipleOf',
  'trim',
  'toLowerCase',
  'toUpperCase',
  'startsWith',
  'endsWith',
  'includes',
  'regex',
  'length',
]);
const unchanged = new Set([
  'parse',
  'safeParse',
  'parseAsync',
  'safeParseAsync',
  'check',
  'clone',
  'register',
  'brand',
  'shape',
  'options',
  'element',
  'enum',
  'def',
  'type',
  '_zod',
]);
const typeNames = new Map([
  ['ZodType', 'ZodMiniType'],
  ['ZodTypeAny', 'ZodMiniType'],
  ['ZodRawShape', 'core.$ZodShape'],
  ['RefinementCtx', 'core.$RefinementCtx'],
]);

function isZodDeclaration(declaration) {
  return /[/\\]zod[/\\]/.test(declaration.getSourceFile().fileName);
}

function createMigrationProgram(fileNames, options, host) {
  // Enterprise files live outside Grafana's node_modules resolution tree.
  return ts.createProgram(
    fileNames,
    {
      ...options,
      paths: {
        ...options.paths,
        zod: [path.resolve(__dirname, '../../node_modules/zod')],
        'zod/*': [path.resolve(__dirname, '../../node_modules/zod/*')],
      },
    },
    host
  );
}

/**
 * Plan all edits against the original program. Never update the checker between
 * files: imported schemas must retain their Classic types throughout the pass.
 */
function migrate(program, fileNames) {
  const checker = program.getTypeChecker();
  const results = new Map();
  const failures = [];
  const fileSet = new Set(fileNames.map((file) => path.resolve(file)));

  function isSchema(node) {
    const type = checker.getTypeAtLocation(node);
    return type.getProperty('_zod')?.declarations?.some(isZodDeclaration) ?? false;
  }

  for (const source of program.getSourceFiles()) {
    if (!fileSet.has(path.resolve(source.fileName)) || source.isDeclarationFile) {
      continue;
    }

    const imports = source.statements.filter(
      (node) =>
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        (node.moduleSpecifier.text === 'zod' || node.moduleSpecifier.text === 'zod/mini')
    );
    // Consumers can operate on imported schemas without importing Zod themselves.
    if (
      !imports.length &&
      !new RegExp(
        `\\.(?:check|description|strict|transform|toJSONSchema|min|max|${[...wrappers.keys(), ...checks].join('|')})\\b`
      ).test(source.text)
    ) {
      continue;
    }

    const replacements = new Map();
    const checkCalls = new Map();
    const typeImports = new Map();
    let valueImportNeeded = false;
    const fail = (node, message) => {
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
      failures.push(`${source.fileName}:${line + 1}:${character + 1}: ${message}`);
    };
    const zodImport = imports[0];
    if (zodImport && !checker.getSymbolAtLocation(zodImport.moduleSpecifier)) {
      fail(zodImport, 'Cannot resolve Zod; ensure Grafana dependencies are installed before migrating.');
      continue;
    }
    if (
      imports.length > 1 ||
      (zodImport &&
        (zodImport.importClause?.name ||
          !zodImport.importClause?.namedBindings ||
          !ts.isNamespaceImport(zodImport.importClause.namedBindings)))
    ) {
      fail(zodImport, 'Expected one namespace import from zod; normalize the import before migrating.');
      continue;
    }

    const namespace = zodImport?.importClause.namedBindings.name;
    const namespaceSymbol = namespace && checker.getSymbolAtLocation(namespace);
    const z = namespace?.text ?? 'z';
    const isNamespace = (node) =>
      ts.isIdentifier(node) && namespaceSymbol && checker.getSymbolAtLocation(node) === namespaceSymbol;
    const useZod = (node) => {
      const inScope = checker.resolveName(z, node, ts.SymbolFlags.Value | ts.SymbolFlags.Namespace, false);
      if (inScope && inScope !== namespaceSymbol) {
        fail(node, `Cannot use the Zod namespace because ${z} is shadowed here.`);
      }
      valueImportNeeded = true;
      return z;
    };
    const replace = (node, render) => replacements.set(node, render);
    const replaceCheck = (node, receiver, args) => {
      checkCalls.set(node, { receiver, args });
      replace(node, (render) => {
        const argumentsList = [];
        const comments = [];
        let current = node;
        while (checkCalls.has(current)) {
          const check = checkCalls.get(current);
          if (current !== node) {
            comments.unshift(callComments(current));
          }
          const argumentsText = check.args(render);
          if (argumentsText.trim()) {
            argumentsList.unshift(argumentsText);
          }
          current = check.receiver;
        }
        return `${comments.join('')}${render(current)}.check(${argumentsList.join(', ')})`;
      });
    };

    function schemaKind(node) {
      const type = checker.getTypeAtLocation(node);
      const internals = type.getProperty('_zod');
      if (!internals) {
        return undefined;
      }
      const def = checker.getTypeOfSymbolAtLocation(internals, node).getProperty('def');
      const kind = def && checker.getTypeOfSymbolAtLocation(def, node).getProperty('type');
      const kindType = kind && checker.getTypeOfSymbolAtLocation(kind, node);
      return kindType?.isStringLiteral() ? kindType.value : undefined;
    }

    function guardType(predicate) {
      const signature = checker.getSignaturesOfType(checker.getTypeAtLocation(predicate), ts.SignatureKind.Call)[0];
      const guard = signature && checker.getTypePredicateOfSignature(signature);
      if (!guard?.type) {
        return undefined;
      }
      const annotation = signature.declaration?.type;
      if (!annotation || !ts.isTypePredicateNode(annotation) || !annotation.type) {
        fail(predicate, 'A narrowing refinement needs an explicit type predicate annotation.');
        return undefined;
      }
      if (annotation.getSourceFile() === source) {
        return annotation.type.getText();
      }
      const declaration = checker.getSymbolAtLocation(predicate)?.declarations?.[0];
      if (declaration && ts.isImportSpecifier(declaration) && ts.isTypeReferenceNode(annotation.type)) {
        const importDeclaration = declaration.parent.parent.parent;
        const module = checker.getSymbolAtLocation(importDeclaration.moduleSpecifier);
        const typeName = annotation.type.typeName.getText();
        const exported = module && checker.getExportsOfModule(module).find((symbol) => symbol.name === typeName);
        if (exported && checker.getDeclaredTypeOfSymbol(exported) === guard.type) {
          const bindings = declaration.parent;
          const existing = bindings.elements.find(
            (specifier) => (specifier.propertyName ?? specifier.name).text === typeName
          );
          if (existing) {
            return existing.name.text;
          }
          const local = checker.resolveName(typeName, source, ts.SymbolFlags.Type | ts.SymbolFlags.Value, false)
            ? `ZodRefinement${typeName}`
            : typeName;
          if (
            local !== typeName &&
            checker.resolveName(local, source, ts.SymbolFlags.Type | ts.SymbolFlags.Value, false)
          ) {
            fail(
              predicate,
              `Cannot import the refinement type ${typeName} because its local name is already in scope.`
            );
            return undefined;
          }
          if (!typeImports.has(bindings)) {
            typeImports.set(bindings, new Map());
          }
          typeImports.get(bindings).set(typeName, local);
          return local;
        }
      }
      fail(predicate, 'Cannot name the narrowed refinement type; export it alongside the predicate before migrating.');
      return undefined;
    }

    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const access = node.expression;
        const receiver = access.expression;
        const method = access.name.text;

        if (isNamespace(receiver) && method === 'preprocess') {
          if (node.arguments.length !== 2) {
            fail(node, 'Expected z.preprocess(transform, schema).');
          } else {
            replace(
              node,
              (render) =>
                `${useZod(node)}.pipe(${z}.transform(${render(node.arguments[0])}), ${render(node.arguments[1])})`
            );
          }
        } else if (isNamespace(receiver) && method === 'object' && ts.isObjectLiteralExpression(node.arguments[0])) {
          for (const property of node.arguments[0].properties) {
            if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
              continue;
            }
            const type = checker.getTypeAtLocation(
              ts.isPropertyAssignment(property) ? property.initializer : property.name
            );
            if (type.flags & ts.TypeFlags.TypeParameter && !type.getConstraint()) {
              for (const declaration of type.symbol.declarations ?? []) {
                if (ts.isTypeParameterDeclaration(declaration) && declaration.getSourceFile() === source) {
                  replace(declaration, () => `${declaration.name.text} extends ${z}.ZodMiniType`);
                }
              }
            }
          }
        } else if (
          !isNamespace(receiver) &&
          (!unchanged.has(method) || method === 'check') &&
          (imports.length ||
            wrappers.has(method) ||
            checks.has(method) ||
            ['check', 'min', 'max', 'strict', 'transform', 'toJSONSchema'].includes(method)) &&
          isSchema(receiver)
        ) {
          const args = (render) =>
            node.arguments
              .map((argument) => source.text.slice(argument.pos, argument.getStart(source)) + render(argument))
              .join(', ');
          if (method === 'check') {
            replaceCheck(node, receiver, args);
          } else if (method === 'toJSONSchema') {
            replace(
              node,
              (render) =>
                `${useZod(node)}.toJSONSchema(${render(receiver)}${node.arguments.length ? `, ${args(render)}` : ''})`
            );
          } else if (wrappers.has(method)) {
            const redundantOptional =
              method === 'optional' &&
              node.arguments.length === 0 &&
              ts.isPropertyAccessExpression(node.parent) &&
              node.parent.name.text === 'default' &&
              ts.isCallExpression(node.parent.parent) &&
              node.parent.parent.expression === node.parent;
            replace(node, (render) =>
              redundantOptional
                ? render(receiver)
                : `${useZod(node)}.${wrappers.get(method)}(${render(receiver)}${node.arguments.length ? `, ${args(render)}` : ''})`
            );
          } else if (checks.has(method)) {
            const narrowed = method === 'refine' && guardType(node.arguments[0]);
            if (narrowed) {
              replace(
                node,
                (render) => `${useZod(node)}.pipe(${render(receiver)}, ${z}.custom<${narrowed}>(${args(render)}))`
              );
            } else {
              replaceCheck(node, receiver, (render) => `${useZod(node)}.${method}(${args(render)})`);
            }
          } else if (method === 'min' || method === 'max') {
            const kind = schemaKind(receiver);
            const check =
              kind === 'number'
                ? method === 'min'
                  ? 'minimum'
                  : 'maximum'
                : kind === 'string' || kind === 'array'
                  ? method === 'min'
                    ? 'minLength'
                    : 'maxLength'
                  : undefined;
            if (check) {
              replaceCheck(node, receiver, (render) => `${useZod(node)}.${check}(${args(render)})`);
            } else {
              fail(node, `Unsupported ${method}() receiver; expected a string, array or number schema.`);
            }
          } else if (method === 'strict') {
            if (
              ts.isCallExpression(receiver) &&
              ts.isPropertyAccessExpression(receiver.expression) &&
              isNamespace(receiver.expression.expression) &&
              receiver.expression.name.text === 'object'
            ) {
              replace(
                node,
                (render) =>
                  `${useZod(node)}.strictObject(${receiver.arguments.map((argument) => render(argument)).join(', ')})`
              );
            } else {
              fail(node, 'Only z.object(...).strict() is supported; use z.strictObject for this schema.');
            }
          } else if (method === 'transform') {
            replace(node, (render) => `${useZod(node)}.pipe(${render(receiver)}, ${z}.transform(${args(render)}))`);
          } else {
            fail(node, `Unsupported Zod method ${method}(); add a tested conversion before migrating.`);
          }
        }
      }

      if (ts.isPropertyAccessExpression(node)) {
        if (isNamespace(node.expression) && typeNames.has(node.name.text)) {
          replace(node, () => `${z}.${typeNames.get(node.name.text)}`);
        } else if (
          ts.isPropertyAccessExpression(node.expression) &&
          isNamespace(node.expression.expression) &&
          node.expression.name.text === 'ZodIssueCode'
        ) {
          const type = checker.getTypeAtLocation(node);
          if (type.isStringLiteral()) {
            replace(node, () => JSON.stringify(type.value));
          } else {
            fail(node, 'Cannot resolve the Zod issue code.');
          }
        } else if (node.name.text === 'description' && isSchema(node.expression)) {
          replace(node, (render) => `${useZod(node)}.globalRegistry.get(${render(node.expression)})?.description`);
        }
      }
      if (ts.isQualifiedName(node) && isNamespace(node.left) && typeNames.has(node.right.text)) {
        replace(node, () => `${z}.${typeNames.get(node.right.text)}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const [bindings, additions] of typeImports) {
      replace(
        bindings,
        (render) =>
          `{ ${[
            ...bindings.elements.map((element) => render(element)),
            ...[...additions].map(([name, local]) => `type ${name}${name === local ? '' : ` as ${local}`}`),
          ].join(', ')} }`
      );
    }

    function callComments(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const access = node.expression;
        const comments = new Map(
          [
            ...(ts.getLeadingCommentRanges(source.text, access.expression.end) ?? []),
            ...(ts.getTrailingCommentRanges(source.text, access.expression.end) ?? []),
          ]
            .filter((comment) => comment.end <= access.name.getStart(source))
            .map((comment) => [comment.pos, source.text.slice(comment.pos, comment.end)])
        );
        if (comments.size) {
          return `${[...comments.values()].join('\n')}\n`;
        }
      }
      return '';
    }

    function render(node) {
      const replacement = replacements.get(node);
      if (replacement) {
        const check = checkCalls.get(node);
        if (check && node.expression.name.text === 'check' && !checkCalls.has(check.receiver)) {
          return renderUnchanged(node);
        }
        return callComments(node) + replacement(render);
      }
      return renderUnchanged(node);
    }

    function renderUnchanged(node) {
      const start = node === source ? 0 : node.getStart(source);
      let text = source.text.slice(start, node.end);
      const edits = [];
      ts.forEachChild(node, (child) => {
        const updated = render(child);
        if (updated !== child.getText(source)) {
          edits.push({ start: child.getStart(source) - start, end: child.end - start, text: updated });
        }
      });
      for (const edit of edits.reverse()) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
      }
      return text;
    }

    let updated = render(source);
    if (zodImport) {
      // Import edits run last so offsets in the original syntax tree remain valid.
      updated = updated.replace(zodImport.getText(source), (text) => text.replace(/(['"])zod\1/, '$1zod/mini$1'));
      if (valueImportNeeded && zodImport.importClause.isTypeOnly) {
        updated = updated.replace(`import type * as ${z}`, `import * as ${z}`);
      }
    } else if (valueImportNeeded) {
      if (checker.resolveName(z, source, ts.SymbolFlags.Value | ts.SymbolFlags.Namespace, false)) {
        fail(source, 'Cannot add the Zod namespace import because z is already in scope.');
      }
      const builtinImports = source.statements.filter(
        (node) =>
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text.startsWith('node:')
      );
      const lastBuiltin = builtinImports.at(-1);
      const firstImport = source.statements.find(ts.isImportDeclaration);
      const offset = lastBuiltin?.end ?? firstImport?.getStart(source) ?? source.statements[0]?.getStart(source) ?? 0;
      const separator = lastBuiltin ? '\n' : '';
      const suffix = lastBuiltin ? '' : '\n\n';
      updated =
        updated.slice(0, offset) + `${separator}import * as z from 'zod/mini';${suffix}` + updated.slice(offset);
    }
    if (imports.length) {
      const parsed = ts.createSourceFile(source.fileName, updated, ts.ScriptTarget.Latest, true);
      const comments = new Map();
      const findComments = (node) => {
        for (const comment of [
          ...(ts.getLeadingCommentRanges(updated, node.pos) ?? []),
          ...(ts.getTrailingCommentRanges(updated, node.end) ?? []),
        ]) {
          comments.set(comment.pos, comment);
        }
        ts.forEachChild(node, findComments);
      };
      findComments(parsed);
      const commentEdits = [];
      for (const comment of comments.values()) {
        let text = updated.slice(comment.pos, comment.end);
        for (const [before, after] of [
          ['z.ZodTypeAny', 'z.ZodMiniType'],
          ['z.ZodType', 'z.ZodMiniType'],
          ['z.RefinementCtx', 'z.core.$RefinementCtx'],
          ['.optional().default(...)', 'z._default(schema, ...)'],
          ['.optional().default()', 'z._default(schema, ...)'],
          ['z.preprocess', 'z.pipe(z.transform(...), schema)'],
          ['.describe()', '.check(z.describe(...))'],
        ]) {
          text = text.replaceAll(before, after);
        }
        commentEdits.push({ start: comment.pos, end: comment.end, text });
      }
      for (const edit of commentEdits.sort((a, b) => b.start - a.start)) {
        updated = updated.slice(0, edit.start) + edit.text + updated.slice(edit.end);
      }
    }
    if (updated !== source.text) {
      results.set(path.resolve(source.fileName), updated);
    }
  }
  if (failures.length) {
    throw new Error(`Zod Mini migration aborted without writing files:\n${failures.join('\n')}`);
  }
  return results;
}

async function main(args) {
  let write = false;
  let selectedFiles;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--write' && !write) {
      write = true;
    } else if (arg === '--files' && selectedFiles === undefined) {
      selectedFiles = args.slice(index + 1).filter((file) => file !== '--write');
      if (selectedFiles.length === 0 || selectedFiles.some((file) => file.startsWith('--'))) {
        throw new Error('Expected TypeScript file paths after --files.');
      }
      break;
    } else {
      throw new Error(
        'Usage: node --max-old-space-size=8192 scripts/codemods/zod-mini.cjs [--write] [--files <path> ...]'
      );
    }
  }
  const root = path.resolve(__dirname, '../..');
  const configPath = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length) {
    throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
  }
  const fileNames = selectedFiles
    ? selectedFiles.map((file) => path.resolve(root, file))
    : execFileSync('git', ['ls-files', '-z', '--', '*.ts', '*.tsx'], { cwd: root })
        .toString()
        .split('\0')
        .filter(Boolean)
        .map((file) => path.join(root, file));
  const program = createMigrationProgram([...new Set([...parsed.fileNames, ...fileNames])], {
    ...parsed.options,
    incremental: false,
  });
  const changes = migrate(program, fileNames);
  const formatted = new Map();
  for (const [file, text] of changes) {
    const config = await prettier.resolveConfig(file);
    formatted.set(file, await prettier.format(text, { ...config, filepath: file }));
  }
  for (const [file, text] of formatted) {
    if (write) {
      fs.writeFileSync(file, text);
    }
    console.log(path.relative(root, file));
  }
  console.log(`${write ? 'Updated' : 'Would update'} ${formatted.size} files.`);
}

module.exports = { createMigrationProgram, migrate };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
