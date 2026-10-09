import { type CompletionContext, type Completion } from '@codemirror/autocomplete';
import { json, jsonLanguage, jsonParseLinter } from '@codemirror/lang-json';
import { syntaxTree } from '@codemirror/language';
import { type Diagnostic, linter } from '@codemirror/lint';
import { EditorState, type Extension } from '@codemirror/state';
import { type EditorView, ViewPlugin } from '@codemirror/view';
import {
  getJSONSchema,
  getJsonPointerAt,
  parseJSONDocumentState,
  stateExtensions,
  updateSchema,
} from 'codemirror-json-schema';
import yaml from 'js-yaml';
import { Draft07, isJsonError, reduceSchema } from 'json-schema-library';

import { type SchemaEditorFormat } from './DashboardSchemaEditor';

export interface DashboardSchemaValidation {
  diagnostics: Diagnostic[];
  hasErrors: boolean;
  hasParseError: boolean;
  /** JSON representation of the current buffer; absent when it cannot be parsed. */
  json?: string;
}

interface DashboardSchemaExtensionOptions {
  format?: SchemaEditorFormat;
  onValidationChange?: (hasErrors: boolean) => void;
  onParseErrorChange?: (hasParseError: boolean) => void;
}

export function createDashboardSchemaValidator(schema: Record<string, unknown>) {
  // The bundled CodeMirror schema linter uses Draft 4, which does not validate
  // Dashboard's if/then discriminated unions.
  const validator = new Draft07(schema);

  return (text: string, format: SchemaEditorFormat = 'json'): DashboardSchemaValidation => {
    let json: string;
    let value: unknown;
    try {
      if (format === 'yaml') {
        const serialized = JSON.stringify(yaml.load(text), null, 2);
        if (serialized === undefined) {
          throw new Error('YAML must contain a JSON value');
        }
        json = serialized;
      } else {
        json = text;
      }
      value = JSON.parse(json);
    } catch (error) {
      return {
        diagnostics: [{ from: 0, to: 0, severity: 'error', message: String(error) }],
        hasErrors: true,
        hasParseError: true,
      };
    }

    // YAML consumers need validation status, not JSON offsets in a YAML buffer.
    const errors = validator.validate(value);
    const pointers = format === 'json' && errors.length > 0 ? getDiagnosticRanges(json) : undefined;
    const diagnostics: Diagnostic[] = [];
    const seen = new Set<string>();
    for (const error of errors) {
      let path = error.data.pointer.replace(/^#/, '');
      let pointer = pointers?.get(path);
      // Missing properties have no token. Highlight the containing object.
      while (!pointer && path) {
        path = path.slice(0, path.lastIndexOf('/'));
        pointer = pointers?.get(path);
      }
      const keyError = error.name === 'NoAdditionalPropertiesError' || error.name === 'InvalidPropertyNameError';
      const from = (keyError ? pointer?.keyFrom : pointer?.from) ?? 0;
      const to = (keyError ? pointer?.keyTo : pointer?.to) ?? from;
      const message = error.message.replaceAll('`#/', '`/');
      const key = `${from}:${to}:${message}`;
      if (!seen.has(key)) {
        diagnostics.push({ from, to, severity: 'error', message, source: 'Dashboard schema' });
        seen.add(key);
      }
    }
    return { diagnostics, hasErrors: diagnostics.length > 0, hasParseError: false, json };
  };
}

function getDiagnosticRanges(text: string) {
  const state = EditorState.create({ doc: text });
  const ranges = new Map<string, { from: number; to: number; keyFrom?: number; keyTo?: number }>();
  // Parse the whole document; editor syntax trees may still be incomplete for large dashboards.
  jsonLanguage.parser.parse(text).iterate({
    enter({ node }) {
      if (node.name === 'Property') {
        const key = node.firstChild!;
        const value = node.lastChild!;
        ranges.set(getJsonPointerAt(state.doc, value, 'json4'), {
          from: value.from,
          to: value.to,
          keyFrom: key.from,
          keyTo: key.to,
        });
      } else if (node.parent?.name === 'Array' || node.parent?.name === 'JsonText') {
        if (!['{', '}', '[', ']', ','].includes(node.name)) {
          ranges.set(getJsonPointerAt(state.doc, node, 'json4'), { from: node.from, to: node.to });
        }
      }
    },
  });
  return ranges;
}

export function createDashboardSchemaExtensions(
  schema: Record<string, unknown>,
  { format = 'json', onValidationChange, onParseErrorChange }: DashboardSchemaExtensionOptions = {}
): Extension[] {
  const validate = createDashboardSchemaValidator(schema);
  const parseLinter = jsonParseLinter();
  const validation = linter(
    (view) => {
      const result = validate(view.state.doc.toString(), format);
      onValidationChange?.(result.hasErrors);
      onParseErrorChange?.(result.hasParseError);
      if (format === 'json' && result.hasParseError) {
        const syntaxDiagnostics = parseLinter(view);
        return syntaxDiagnostics.length ? syntaxDiagnostics : result.diagnostics;
      }
      return result.diagnostics;
    },
    { delay: 100 }
  );

  if (format === 'yaml') {
    return [validation];
  }

  // Reconfiguration retains state fields; keep completion's schema in sync
  // with the validator without changing another editor's schema.
  const schemaUpdate = ViewPlugin.fromClass(
    class {
      private active = true;

      constructor(view: EditorView) {
        queueMicrotask(() => {
          if (this.active && getJSONSchema(view.state) !== schema) {
            updateSchema(view, schema);
          }
        });
      }

      destroy() {
        this.active = false;
      }
    }
  );

  return [
    json(),
    stateExtensions(schema),
    jsonLanguage.data.of({ autocomplete: dashboardSchemaCompletion(schema) }),
    schemaUpdate,
    validation,
  ];
}

function dashboardSchemaCompletion(initialSchema: Record<string, unknown>) {
  let schema: object = initialSchema;
  let draft = new Draft07(initialSchema);
  return (context: CompletionContext) => {
    const node = syntaxTree(context.state).resolveInner(context.pos, -1);
    const object = node.name === 'Object' ? node : node.name === '{' ? node.parent : null;
    const propertyName = node.name === 'PropertyName' || object?.name === 'Object';
    const primitive = ['String', 'Number', 'True', 'False', 'Null'].includes(node.name);
    const property = node.name === 'Property' ? node : node.parent?.name === 'Property' ? node.parent : null;
    const colon = property?.getChild(':');
    const incompleteValue = !propertyName && !primitive && colon && context.pos >= colon.to;
    if (!propertyName && !primitive && !incompleteValue) {
      return null;
    }
    const currentSchema = getJSONSchema(context.state);
    if (!currentSchema) {
      return null;
    }
    if (currentSchema !== schema) {
      schema = currentSchema;
      draft = new Draft07(currentSchema);
    }
    const { data } = parseJSONDocumentState(context.state);
    const pointer = getJsonPointerAt(
      context.state.doc,
      incompleteValue ? property!.firstChild! : (object ?? node),
      'json4'
    );
    const targetPointer = object ? pointer : propertyName ? pointer.slice(0, pointer.lastIndexOf('/')) : pointer;
    // Resolve only the cursor's schema. The package completion source resolves
    // every sibling property's schema, which blocks typing on Dashboard schemas.
    const target = draft.getSchema({ pointer: targetPointer || '#', data });
    if (!target || isJsonError(target)) {
      return null;
    }
    const from = object
      ? context.pos
      : incompleteValue
        ? (context.matchBefore(/[\w-]*/)?.from ?? context.pos)
        : node.from;
    const to = object || incompleteValue ? context.pos : node.to;
    const prefix = context.state.sliceDoc(from, context.pos).replace(/^"/, '');
    const options: Completion[] = [];
    if (propertyName) {
      const path = targetPointer
        .split('/')
        .slice(1)
        .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
      const parent = path.reduce((value, key) => value?.[key], data);
      const objectSchema = reduceSchema(draft, target, parent, targetPointer || '#');
      const currentKey = pointer
        .slice(pointer.lastIndexOf('/') + 1)
        .replaceAll('~1', '/')
        .replaceAll('~0', '~');
      for (const [key, property] of Object.entries(objectSchema.properties ?? {})) {
        if (!key.startsWith(prefix) || (key !== currentKey && parent && key in parent)) {
          continue;
        }
        const resolved = property && typeof property === 'object' ? draft.resolveRef(property) : undefined;
        options.push({
          label: key,
          type: 'property',
          apply: JSON.stringify(key) + (node.parent?.getChild(':') ? '' : ': '),
          info: resolved?.description,
        });
      }
    } else {
      const values: unknown[] = [...(target.enum ?? [])];
      if (target.const !== undefined) {
        values.push(target.const);
      }
      if (target.default !== undefined) {
        values.push(target.default);
      }
      const types = Array.isArray(target.type) ? target.type : [target.type];
      if (types.includes('boolean')) {
        values.push(true, false);
      }
      if (types.includes('null')) {
        values.push(null);
      }
      for (const value of new Set(values)) {
        const label = typeof value === 'string' ? value : JSON.stringify(value);
        if (label?.startsWith(prefix)) {
          options.push({ label, apply: JSON.stringify(value), type: typeof value });
        }
      }
    }
    return { from, to, options, filter: false };
  };
}
