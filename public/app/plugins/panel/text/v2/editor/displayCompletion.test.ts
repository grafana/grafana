import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import { FieldType, toDataFrame } from '@grafana/data';

import { buildRows, compileTemplate } from '../handlebars';

import { displayCompletion } from './displayCompletion';

const fieldNames = ['service', 'cpu', 'Memory usage', 'say "hi"', "it's"];

function complete(docWithCursor: string, explicit = false) {
  const cursor = docWithCursor.indexOf('|');
  const doc = docWithCursor.replace('|', '');
  const pos = cursor === -1 ? doc.length : cursor;

  return displayCompletion(fieldNames)(new CompletionContext(EditorState.create({ doc }), pos, explicit));
}

function labelsOf(docWithCursor: string, explicit = false) {
  return complete(docWithCursor, explicit)?.options.map((option) => option.label);
}

describe('displayCompletion', () => {
  describe('the helper name', () => {
    it.each([
      { desc: 'at the start of an expression', doc: '# Fleet\n{{di', from: 10 },
      { desc: 'at the start of a block', doc: '{{#dis', from: 3 },
      { desc: 'in a subexpression', doc: '{{#if (eq (d', from: 11 },
      { desc: 'in a triple-brace expression', doc: '{{{disp', from: 3 },
      { desc: 'before the rest of the line', doc: '{{di|}} of {{host}}', from: 2 },
    ])('offers `display` $desc', ({ doc, from }) => {
      const result = complete(doc);

      expect(result?.from).toBe(from);
      expect(result?.options).toEqual([expect.objectContaining({ label: 'display', type: 'function' })]);
    });

    it('offers `display` in an empty expression when completion is requested', () => {
      const result = complete('{{', true);

      expect(result?.from).toBe(2);
      expect(result?.options.map((option) => option.label)).toEqual(['display']);
    });

    it.each([
      { desc: 'an empty expression nobody asked to complete', doc: '{{' },
      { desc: 'a word `display` does not start with', doc: '{{da' },
      { desc: 'the whole name', doc: '{{display' },
      { desc: 'different capitals', doc: '{{Dis' },
      { desc: 'a closing tag', doc: '{{/dis' },
      { desc: 'an argument of another helper', doc: '{{eq dis' },
      { desc: 'a parenthesis outside an expression', doc: 'See (dis' },
      { desc: 'a parenthesis after a closed expression', doc: '{{host}} (dis' },
    ])('offers nothing for $desc', ({ doc }) => {
      expect(complete(doc)).toBeNull();
    });
  });

  describe('the field name', () => {
    it('lists the fields after the opening quote of the first argument', () => {
      const result = complete('{{display "');

      expect(result?.from).toBe(11);
      expect(result?.options.map((option) => option.label)).toEqual([
        'service',
        'cpu',
        'Memory usage',
        'say "hi"',
        "it's",
      ]);
    });

    it.each([
      { desc: 'what is typed so far, spaces included', doc: '{{#each data}}{{display "Memory us', from: 25 },
      { desc: 'a single-quoted argument', doc: "{{display 'cp", from: 11 },
      { desc: 'the argument of a block', doc: '{{#display "', from: 12 },
      { desc: 'the argument of a subexpression', doc: '{{#if (display "st', from: 16 },
      { desc: 'only the text before the cursor', doc: '{{display "cp|"}}', from: 11 },
    ])('replaces $desc', ({ doc, from }) => {
      const result = complete(doc);

      expect(result?.from).toBe(from);
      expect(result?.options).toHaveLength(5);
    });

    it('escapes the quote the argument is written in, and no other', () => {
      const inserted = (doc: string) =>
        complete(doc)?.options.map((option) => (typeof option.apply === 'string' ? option.apply : option.label));

      expect(inserted('{{display "')).toEqual(['service', 'cpu', 'Memory usage', 'say \\"hi\\"', "it's"]);
      expect(inserted("{{display '")).toEqual(['service', 'cpu', 'Memory usage', 'say "hi"', "it\\'s"]);
    });

    it.each(['"', "'"])('inserts text that resolves the field it names inside %s quotes', (quote) => {
      const frame = toDataFrame({
        fields: fieldNames.map((name, index) => ({ name, type: FieldType.string, values: [`value ${index}`] })),
      });
      const [row] = buildRows(frame, [frame]);
      const options = complete(`{{display ${quote}`)?.options ?? [];

      const rendered = options.map((option) =>
        compileTemplate(`{{display ${quote}${option.apply}${quote}}}`, (value) => value)(row)
      );

      expect(rendered).toEqual(['value 0', 'value 1', 'value 2', 'value 3', 'value 4']);
    });

    it('leaves out a field whose name cannot be quoted', () => {
      const source = displayCompletion(['cpu', 'trailing\\']);
      const doc = '{{display "';
      const result = source(new CompletionContext(EditorState.create({ doc }), doc.length, false));

      expect(result?.options.map((option) => option.label)).toEqual(['cpu']);
    });

    it('offers nothing once the first argument is closed', () => {
      expect(complete('{{display "cpu"')).toBeNull();
    });

    it('offers nothing for a quote outside an expression', () => {
      expect(complete('Call it display "')).toBeNull();
    });
  });

  describe('the property', () => {
    it('lists the display properties after the opening quote of the second argument', () => {
      const result = complete('{{display "cpu" "');

      expect(result?.from).toBe(17);
      expect(result?.options.map((option) => option.label)).toEqual([
        'text',
        'prefix',
        'suffix',
        'numeric',
        'color',
        'percent',
        'icon',
      ]);
    });

    it('says where the color comes from', () => {
      const color = complete('{{display "cpu" "')?.options.find((option) => option.label === 'color');

      expect(color).toMatchObject({
        info: 'Color of the value mapping that matched, or else of the threshold',
        type: 'property',
      });
    });

    it.each([
      { desc: 'single quotes', doc: "{{display 'Memory usage' 'co", from: 26 },
      { desc: 'a field name with an escaped quote', doc: '{{display "say \\"hi\\"" "', from: 24 },
      { desc: 'a subexpression', doc: '{{#if (eq (display "status" "te', from: 29 },
      { desc: 'a block', doc: '{{#display "cpu" "', from: 18 },
    ])('replaces what is typed so far in $desc', ({ doc, from }) => {
      expect(complete(doc)?.from).toBe(from);
      expect(labelsOf(doc)).toContain('color');
    });

    it('offers nothing for a third argument', () => {
      expect(complete('{{display "cpu" "color" "')).toBeNull();
    });
  });
});
