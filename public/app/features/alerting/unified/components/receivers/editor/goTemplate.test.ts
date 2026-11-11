import { CompletionContext, type CompletionSource, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { ensureSyntaxTree, matchBrackets, syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { goTemplate } from './goTemplate';
import { snippets } from './templateDataSuggestions';

function createState(doc: string, pos = doc.length) {
  const state = EditorState.create({ doc, selection: { anchor: pos }, extensions: [goTemplate()] });
  ensureSyntaxTree(state, state.doc.length, Infinity);
  return state.update({}).state;
}

async function complete(docWithCursor: string, explicit = false) {
  const pos = docWithCursor.indexOf('¦');
  const state = createState(docWithCursor.replace('¦', ''), pos);
  const [source] = state.languageDataAt<CompletionSource>('autocomplete', pos);
  return source(new CompletionContext(state, pos, explicit));
}

describe('Alerting Go-template language', () => {
  it.each(['{{ .Status }}', '{{- .Status -}}'])('matches action delimiters in %s in both directions', (doc) => {
    const state = createState(doc);
    expect(matchBrackets(state, 0, 1)).toMatchObject({ matched: true });
    expect(matchBrackets(state, doc.length, -1)).toMatchObject({ matched: true });
  });

  it('highlights actions, trim delimiters, functions, variables, numbers, and pipelines while leaving prose plain', () => {
    const state = createState('Status {{- if gt (len .Alerts) 0 -}}{{ .Status | toUpper }}{{ end }}');
    const tokens: Array<[string, string]> = [];
    highlightTree(
      syntaxTree(state),
      tagHighlighter([
        { tag: tags.keyword, class: 'keyword' },
        { tag: tags.function(tags.variableName), class: 'function' },
        { tag: tags.variableName, class: 'variable' },
        { tag: tags.number, class: 'number' },
        { tag: tags.brace, class: 'delimiter' },
        { tag: tags.operator, class: 'operator' },
      ]),
      (from, to, style) => tokens.push([state.sliceDoc(from, to), style])
    );
    expect(tokens).toEqual([
      ['{{-', 'delimiter'],
      ['if', 'keyword'],
      ['gt', 'function'],
      ['len', 'function'],
      ['.Alerts', 'variable'],
      ['0', 'number'],
      ['-}}', 'delimiter'],
      ['{{', 'delimiter'],
      ['.Status', 'variable'],
      ['|', 'operator'],
      ['toUpper', 'function'],
      ['}}', 'delimiter'],
      ['{{', 'delimiter'],
      ['end', 'keyword'],
      ['}}', 'delimiter'],
    ]);
  });

  it('keeps delimiters inside escaped strings, raw strings, and multiline comments from closing the action', async () => {
    const doc = '{{ "escaped \\" }}" `raw }}\n{{` /* comment }}\n{{ */ .Al¦ }}';
    const result = await complete(doc);
    expect(result?.options.map((option) => option.label)).toContain('Alerts');

    const state = createState(doc.replace('¦', ''));
    const tokens: Array<[string, string]> = [];
    highlightTree(
      syntaxTree(state),
      tagHighlighter([
        { tag: tags.string, class: 'string' },
        { tag: tags.comment, class: 'comment' },
      ]),
      (from, to, style) => tokens.push([state.sliceDoc(from, to), style])
    );
    expect(tokens).toEqual([
      ['"', 'string'],
      ['escaped \\" }}', 'string'],
      ['"', 'string'],
      ['`', 'string'],
      ['raw }}', 'string'],
      ['{{', 'string'],
      ['`', 'string'],
      ['/*', 'comment'],
      [' comment }}', 'comment'],
      ['{{ ', 'comment'],
      ['*/', 'comment'],
    ]);
  });
});

describe('Alerting Go-template completion', () => {
  it.each([
    { doc: '{{ .¦ }}', labels: ['Alerts', 'Receiver', 'Status', 'GroupLabels', 'Labels', 'Annotations', 'OrgID'] },
    { doc: '{{ .Alerts.¦ }}', labels: ['Firing', 'Resolved'] },
    { doc: '{{ .CommonLabels.¦ }}', labels: ['SortedPairs', 'Names', 'Values', 'Remove'] },
    { doc: '{{ range .Alerts }}{{ .Labels.¦ }}{{ end }}', labels: ['SortedPairs', 'Names', 'Values', 'Remove'] },
    { doc: '{{-\n .Al¦', labels: ['Alerts', 'Receiver', 'GroupLabels'] },
    { doc: '{{ .Status }}{{ .¦ }}', labels: ['Alerts', 'Receiver', 'Status'] },
    { doc: '{{ range .Alerts }}{{ $.¦ }}{{ end }}', labels: ['Receiver', 'ExternalURL', 'CommonLabels'] },
  ])('offers template data at $doc', async ({ doc, labels }) => {
    const result = await complete(doc);
    expect(result?.options.map((option) => option.label)).toEqual(expect.arrayContaining(labels));
  });

  it('preserves alert context, types, and Markdown documentation', async () => {
    const result = await complete('{{ .¦ }}');
    const status = result?.options.find((option) => option.label === 'Status' && option.detail?.includes('(Alert)'));
    expect(status).toMatchObject({ label: 'Status', detail: '(Alert) string', type: 'property', apply: 'Status' });
    if (typeof status?.info !== 'function') {
      throw new Error('Expected alert documentation');
    }
    const info = await status.info(status);
    expect(info).toHaveTextContent('Status of the alert. It can be firing or resolved');
    expect(info).toContainHTML('<code>firing</code>');
  });

  it('offers Alertmanager and Gomplate functions on explicit completion', async () => {
    const result = await complete('{{ ¦ }}', true);
    expect(result?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'join', type: 'function', detail: 'function(separator string, s []string)' }),
        expect.objectContaining({ label: 'data.ToJSON', type: 'function', detail: 'function(obj any)' }),
      ])
    );
  });

  it.each(['data', 'time'])('does not treat the local $%s variable as a function namespace', async (name) => {
    expect((await complete(`{{ ${name}.¦ }}`))?.options.map((option) => option.label)).toContain(
      name === 'data' ? 'data.ToJSON' : 'time.Now'
    );
    expect(await complete(`{{ $${name} := . }}{{ $${name}.¦ }}`)).toBeNull();
  });

  it.each(['"abc }}', "'abc }}", '"', "'"])(
    'recovers highlighting and completion after an unterminated %s on the previous line',
    async (string) => {
      const doc = `{{ ${string}\nHello {{ .¦ }}`;
      expect((await complete(doc))?.options.map((option) => option.label)).toContain('Alerts');
      const state = createState(doc.replace('¦', ''));
      expect(matchBrackets(state, doc.lastIndexOf('{{'), 1)).toMatchObject({ matched: true });
    }
  );

  it('offers snippets on a blank line after an unterminated quoted string', async () => {
    expect((await complete('{{ "abc\n\n¦', true))?.options.map((option) => option.label)).toContain('alertsloop');
  });

  it.each([
    {
      doc: 'Summary: alert¦ tail',
      label: 'alertsloop',
      from: 9,
      expected:
        'Summary: \n{{ range .Alerts }}\n  Status: {{ .Status }}\n  Starts at: {{ .StartsAt }}\n{{ end }}\n tail',
    },
    { doc: '{{ .Alerts.Fir¦ }}', label: 'Firing', from: 11, expected: '{{ .Alerts.Firing }}' },
    { doc: '{{ .CommonLabels.Sor¦ }}', label: 'SortedPairs', from: 17, expected: '{{ .CommonLabels.SortedPairs }}' },
    { doc: '{{ data.ToJ¦ }}', label: 'data.ToJSON', from: 3, expected: '{{ data.ToJSON }}' },
    { doc: '{{ $.Ext¦ }}', label: 'ExternalURL', from: 5, expected: '{{ $.ExternalURL }}' },
  ])('replaces only the completion prefix at $doc', async ({ doc, label, from, expected }) => {
    const result = await complete(doc);
    expect(result?.from).toBe(from);
    const pos = doc.indexOf('¦');
    const view = new EditorView({ state: createState(doc.replace('¦', ''), pos) });
    try {
      const option = result!.options.find((item) => item.label === label)!;
      if (typeof option.apply === 'function') {
        option.apply(view, option, result!.from, result!.to!);
      } else {
        view.dispatch({ changes: { from: result!.from, to: result!.to, insert: option.apply ?? option.label } });
      }
      expect(view.state.doc.toString()).toBe(expected);
    } finally {
      view.destroy();
    }
  });

  it.each(['{{ "string }} .¦" }}', '{{ `raw }}\n\n¦` }}', "{{ 'x¦' }}", '{{ /* comment }}\n\n¦ */ }}'])(
    'suppresses completion inside quotes and comments at $doc',
    async (doc) => {
      expect(await complete('{{ .¦ }}')).toMatchObject({ from: 4 });
      expect(await complete(doc, true)).toBeNull();
    }
  );

  it('offers only snippets outside actions, including after a closed action', async () => {
    const result = await complete('{{ .Status }}\n¦', true);
    expect(result?.options.map((option) => option.label)).toEqual([
      'alertsloop',
      'alertdetails',
      'grouplabelsloop',
      'commonlabelsloop',
      'commonannotationsloop',
      'labelsloop',
      'annotationsloop',
      'json',
    ]);
    expect(await complete('¦')).toBeNull();
  });

  it('accepts a snippet with the keyboard and places the cursor after its Go-template content', async () => {
    const user = userEvent.setup();
    const view = new EditorView({
      state: EditorState.create({
        doc: 'alertsloop',
        selection: { anchor: 10 },
        extensions: [goTemplate(), autocompletion({ interactionDelay: 0 }), keymap.of(completionKeymap)],
      }),
      parent: document.body,
    });
    try {
      view.focus();
      await user.keyboard('{Control>}[Space]{/Control}');
      await screen.findByRole('option', { name: /alertsloop/ });
      await user.keyboard('{Enter}');
      await waitFor(() =>
        expect(view.state.doc.toString()).toBe(
          '\n{{ range .Alerts }}\n  Status: {{ .Status }}\n  Starts at: {{ .StartsAt }}\n{{ end }}\n'
        )
      );
      expect(view.state.selection.main.anchor).toBe(84);
    } finally {
      view.destroy();
    }
  });

  it('supports Tab and Shift-Tab between snippet fields without treating Go braces as placeholders', async () => {
    const snippet = jest.replaceProperty(
      snippets.alerts,
      'snippet',
      '{{ range ${1:.Alerts} }}\n${2:body}\n{{ end }}${0}'
    );
    const user = userEvent.setup();
    const result = await complete('alerts¦');
    const view = new EditorView({ state: createState('alerts') });
    document.body.appendChild(view.dom);
    try {
      const option = result!.options.find((item) => item.label === 'alertsloop')!;
      if (typeof option.apply !== 'function') {
        throw new Error('Expected a snippet completion');
      }
      option.apply(view, option, result!.from, result!.to!);
      expect(view.state.doc.toString()).toBe('{{ range .Alerts }}\nbody\n{{ end }}');
      expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('.Alerts');
      view.focus();
      await user.keyboard('{Tab}');
      expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('body');
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('.Alerts');
      await user.keyboard('{Tab}{Tab}');
      expect(view.state.selection.main.anchor).toBe(34);
      expect(view.state.selection.main.empty).toBe(true);
    } finally {
      view.destroy();
      snippet.restore();
    }
  });
});
