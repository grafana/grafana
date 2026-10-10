import { type CompletionContext } from '@codemirror/autocomplete';
import { json, jsonLanguage, jsonParseLinter } from '@codemirror/lang-json';
import { syntaxTree } from '@codemirror/language';
import { type Diagnostic, linter } from '@codemirror/lint';
import { EditorState, type Extension } from '@codemirror/state';
import { type EditorView, ViewPlugin } from '@codemirror/view';
import {
  getJSONSchema,
  getJsonPointerAt,
  jsonCompletion,
  parseJSONDocumentState,
  stateExtensions,
  updateSchema,
} from 'codemirror-json-schema';
import yaml from 'js-yaml';
import { Draft07 } from 'json-schema-library';

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
  const validation = linter((view) => {
    const result = validate(view.state.doc.toString(), format);
    onValidationChange?.(result.hasErrors);
    onParseErrorChange?.(result.hasParseError);
    if (format === 'json' && result.hasParseError) {
      const syntaxDiagnostics = parseLinter(view);
      return syntaxDiagnostics.length ? syntaxDiagnostics : result.diagnostics;
    }
    return result.diagnostics;
  });

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
    jsonLanguage.data.of({ autocomplete: dashboardSchemaCompletion() }),
    schemaUpdate,
    validation,
  ];
}

function dashboardSchemaCompletion() {
  let editingProperty: string | undefined;
  const complete = jsonCompletion({
    jsonParser: (state) => {
      const parsed = parseJSONDocumentState(state);
      if (editingProperty) {
        const path = editingProperty
          .slice(1)
          .split('/')
          .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
        const key = path.pop()!;
        let parent = parsed.data;
        for (const part of path) {
          parent = parent?.[part];
        }
        // A partially typed property is not data from which to infer a schema.
        // Otherwise the library infers e.g. `ti: ""` as a string and loses `title` suggestions.
        if (parent && typeof parent === 'object') {
          delete parent[key];
        }
      }
      return parsed;
    },
  });
  return (context: CompletionContext) => {
    const node = syntaxTree(context.state).resolveInner(context.pos, -1);
    editingProperty = node.name === 'PropertyName' ? getJsonPointerAt(context.state.doc, node, 'json4') : undefined;
    return complete(context);
  };
}
