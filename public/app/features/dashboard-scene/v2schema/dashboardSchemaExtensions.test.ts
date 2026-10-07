/** @jest-environment-options {"customExportConditions": ["@grafana-app/source", "node", "node-addons"]} */

import { type CompletionSource, CompletionContext } from '@codemirror/autocomplete';
import { forceLinting, forEachDiagnostic } from '@codemirror/lint';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { waitFor } from '@testing-library/react';

import { createDashboardSchemaExtensions, createDashboardSchemaValidator } from './dashboardSchemaExtensions';

// Shiki's ESM/WASM tooltip renderer cannot run in Jest's CommonJS environment.
// Keep the real schema engine, completion source, and CodeMirror extensions.
jest.mock(require.resolve('codemirror-json-schema').replace('index.js', 'utils/markdown.js'), () => ({
  renderMarkdown: (text: string) => text,
}));

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['kind', 'spec'],
  properties: {
    kind: { const: 'Dashboard' },
    spec: {
      $ref: '#/definitions/Spec',
    },
  },
  definitions: {
    Spec: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Dashboard title' },
        theme: { enum: ['light', 'dark'] },
      },
    },
  },
};

describe('Dashboard schema extensions', () => {
  const views: EditorView[] = [];

  function createView(doc: string, extensions = createDashboardSchemaExtensions(schema)) {
    const view = new EditorView({ state: EditorState.create({ doc, extensions }) });
    views.push(view);
    return view;
  }

  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
  });

  it('locates a referenced schema error on its JSON value', () => {
    const text = '{"kind":"Dashboard","spec":{"title":123}}';
    const result = createDashboardSchemaValidator(schema)(text);
    expect(result).toMatchObject({ hasErrors: true, hasParseError: false, json: text });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ from: 36, to: 39, severity: 'error', source: 'Dashboard schema' }),
    ]);
    expect(text.slice(result.diagnostics[0].from, result.diagnostics[0].to)).toBe('123');
  });

  it('highlights the containing object when a required property is missing', () => {
    const text = '{"kind":"Dashboard","spec":{}}';
    const result = createDashboardSchemaValidator(schema)(text);
    expect(result).toMatchObject({ hasErrors: true, hasParseError: false });
    expect(result.diagnostics[0].message).toContain('required property `title`');
    expect(text.slice(result.diagnostics[0].from, result.diagnostics[0].to)).toBe('{}');
  });

  it('validates YAML using the same schema after conversion to JSON', () => {
    const validate = createDashboardSchemaValidator(schema);
    const invalid = validate('kind: Dashboard\nspec:\n  title: 123', 'yaml');
    expect(invalid).toMatchObject({ hasErrors: true, hasParseError: false });
    expect(invalid.diagnostics[0]).toMatchObject({ from: 0, to: 0, severity: 'error' });

    const valid = validate('kind: Dashboard\nspec:\n  title: Example # keep this comment in the editor', 'yaml');
    expect(valid).toEqual({
      hasErrors: false,
      hasParseError: false,
      diagnostics: [],
      json: '{\n  "kind": "Dashboard",\n  "spec": {\n    "title": "Example"\n  }\n}',
    });
  });

  it.each([
    ['json', '{"spec": // comment\n {}}'],
    ['json', '{"spec":{},}'],
    ['yaml', 'spec: ['],
    ['yaml', ''],
    ['yaml', 'spec: &spec\n  recursive: *spec'],
  ] as const)('reports a parse error for %s buffer %s without exposing stale JSON', (format, text) => {
    const result = createDashboardSchemaValidator(schema)(text, format);
    expect(result).toMatchObject({ hasErrors: true, hasParseError: true, diagnostics: [expect.any(Object)] });
    expect(result.json).toBeUndefined();
  });

  it('reports validation and parse status when JSON is corrected', async () => {
    const onValidationChange = jest.fn();
    const onParseErrorChange = jest.fn();
    const view = createView(
      '{"kind":"Other","spec":{"title":"Example"}}',
      createDashboardSchemaExtensions(schema, {
        onValidationChange,
        onParseErrorChange,
      })
    );
    forceLinting(view);
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(true));
    expect(onParseErrorChange).toHaveBeenLastCalledWith(false);
    const messages: string[] = [];
    forEachDiagnostic(view.state, (diagnostic) => messages.push(diagnostic.message));
    expect(messages[0]).toContain('Dashboard');

    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '{' } });
    forceLinting(view);
    await waitFor(() => expect(onParseErrorChange).toHaveBeenLastCalledWith(true));

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '{"kind":"Dashboard","spec":{"title":"Example"}}' },
    });
    forceLinting(view);
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));
    expect(onParseErrorChange).toHaveBeenLastCalledWith(false);
  });

  it('shows and clears schema diagnostics within 100ms of an edit', async () => {
    jest.useFakeTimers();
    try {
      const view = createView('{"kind":"Dashboard","spec":{"title":"Example"}}');
      await jest.advanceTimersByTimeAsync(1000);

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '{"kind":"Dashboard","spec":{"title":123}}' },
      });
      await jest.advanceTimersByTimeAsync(100);
      const messages: string[] = [];
      forEachDiagnostic(view.state, (diagnostic) => messages.push(diagnostic.message));
      expect(messages).toEqual([expect.stringContaining('string')]);

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '{"kind":"Dashboard","spec":{"title":"Example"}}' },
      });
      await jest.advanceTimersByTimeAsync(100);
      const corrected: string[] = [];
      forEachDiagnostic(view.state, (diagnostic) => corrected.push(diagnostic.message));
      expect(corrected).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports YAML schema errors, syntax errors, and recovery from the current buffer', async () => {
    const onValidationChange = jest.fn();
    const onParseErrorChange = jest.fn();
    const view = createView(
      'kind: Dashboard\nspec:\n  title: 123',
      createDashboardSchemaExtensions(schema, {
        format: 'yaml',
        onValidationChange,
        onParseErrorChange,
      })
    );
    forceLinting(view);
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(true));
    expect(onParseErrorChange).toHaveBeenLastCalledWith(false);

    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'spec: [' } });
    forceLinting(view);
    await waitFor(() => expect(onParseErrorChange).toHaveBeenLastCalledWith(true));

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'kind: Dashboard\nspec:\n  title: Example' },
    });
    forceLinting(view);
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));
    expect(onParseErrorChange).toHaveBeenLastCalledWith(false);
  });

  async function complete(state: EditorState, pos: number) {
    const [source] = state.languageDataAt<CompletionSource>('autocomplete', pos);
    return await source(new CompletionContext(state, pos, true));
  }

  it('completes referenced property names and enum values', async () => {
    const properties = EditorState.create({
      doc: '{"kind":"Dashboard","spec":{"ti":""}}',
      extensions: createDashboardSchemaExtensions(schema),
    });
    const propertyResult = await complete(properties, properties.doc.toString().indexOf('ti') + 2);
    expect(propertyResult?.options.map((option) => option.label)).toContain('title');
    const title = propertyResult!.options.find((option) => option.label === 'title')!;
    const edited = properties.update({
      changes: { from: propertyResult!.from, to: propertyResult!.to, insert: title.apply as string },
    }).state;
    expect(JSON.parse(edited.doc.toString())).toEqual({ kind: 'Dashboard', spec: { title: '' } });

    const values = EditorState.create({
      doc: '{"kind":"Dashboard","spec":{"theme":""}}',
      extensions: createDashboardSchemaExtensions(schema),
    });
    const valueResult = await complete(values, values.doc.toString().indexOf('""') + 1);
    expect(valueResult?.options.map((option) => option.label)).toEqual(['light', 'dark']);
  });

  it.each([
    [{ type: 'boolean' }, ['false', 'true']],
    [{ type: 'null' }, ['null']],
    [{ type: 'string', default: 'quoted "value"' }, ['quoted "value"']],
  ])('completes missing values and inserts valid JSON for schema %j', async (property, labels) => {
    const state = EditorState.create({
      doc: '{"value": }',
      extensions: createDashboardSchemaExtensions({ type: 'object', properties: { value: property } }),
    });
    const result = await complete(state, state.doc.length - 1);
    expect(result?.options.map((option) => option.label).sort()).toEqual(labels);
    const option = result!.options[0];
    expect(typeof option.apply).toBe('string');
    const edited = state.update({
      changes: { from: result!.from, to: result!.to, insert: option.apply as string },
    }).state;
    expect(() => JSON.parse(edited.doc.toString())).not.toThrow();
  });

  it('updates completion and validation together without affecting another editor', async () => {
    const compartment = new Compartment();
    const onValidationChange = jest.fn();
    const view = createView('{"":""}', [
      compartment.of(createDashboardSchemaExtensions(schema, { onValidationChange })),
    ]);
    const other = createView('{"":""}');
    const nextSchema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } } };
    view.dispatch({
      effects: compartment.reconfigure(createDashboardSchemaExtensions(nextSchema, { onValidationChange })),
    });
    await Promise.resolve();
    expect((await complete(view.state, 2))?.options.map((option) => option.label)).toEqual(['name']);
    expect((await complete(other.state, 2))?.options.map((option) => option.label)).toEqual(['kind', 'spec']);
    forceLinting(view);
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(true));
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '{"name":"Example"}' } });
    forceLinting(view);
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));
  });
});
