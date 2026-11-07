import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

import { hclLanguage } from './hcl';

function tokens(doc: string): Array<[string, string]> {
  let state = EditorState.create({ doc, extensions: [hclLanguage] });
  ensureSyntaxTree(state, state.doc.length, Infinity);
  state = state.update({}).state;
  const result: Array<[string, string]> = [];
  syntaxTree(state).iterate({
    enter({ type, from, to }) {
      if (!type.isTop && type.name !== 'punctuation' && type.name !== 'operator') {
        result.push([doc.slice(from, to), type.name]);
      }
    },
  });
  return result;
}

it('highlights Terraform blocks and exported attributes and literals', () => {
  expect(
    tokens('resource "grafana_rule_group" "alerts" {\norg_id = 1\nis_paused = false\nfor = "2m"\nlabels = null\n}')
  ).toEqual([
    ['resource', 'typeName'],
    ['"grafana_rule_group"', 'string'],
    ['"alerts"', 'string'],
    ['org_id', 'propertyName'],
    ['1', 'number'],
    ['is_paused', 'propertyName'],
    ['false', 'bool'],
    ['for', 'propertyName'],
    ['"2m"', 'string'],
    ['labels', 'propertyName'],
    ['null', 'null'],
  ]);
});

it('keeps escaped quotes, JSON, and escaped template delimiters inside strings', () => {
  expect(tokens('model = "{\\"expr\\":\\"$${literal} %%{directive}\\"}"\nafter = 2')).toEqual([
    ['model', 'propertyName'],
    ['"{\\"expr\\":\\"$${literal} %%{directive}\\"}"', 'string'],
    ['after', 'propertyName'],
    ['2', 'number'],
  ]);
});

it('ends line and block comments before highlighting the following code', () => {
  expect(tokens('# comment\n/* first\nsecond */ value = 1 // last\nnext = 2')).toEqual([
    ['# comment', 'comment'],
    ['/* first', 'comment'],
    ['second */', 'comment'],
    ['value', 'propertyName'],
    ['1', 'number'],
    ['// last', 'comment'],
    ['next', 'propertyName'],
    ['2', 'number'],
  ]);
});

it('returns to the string after interpolation with nested objects and quoted interpolation', () => {
  expect(tokens('message = "${jsonencode({ key = "${var.name}" })} suffix"\nafter = true')).toEqual([
    ['message', 'propertyName'],
    ['"', 'string'],
    ['jsonencode', 'variableName.function'],
    ['key', 'propertyName'],
    ['"', 'string'],
    ['var', 'variableName'],
    ['name', 'variableName'],
    ['"', 'string'],
    [' suffix"', 'string'],
    ['after', 'propertyName'],
    ['true', 'bool'],
  ]);
});

it('highlights template directives without ending the surrounding quoted string', () => {
  expect(tokens('message = "%{ if name != "" }yes%{ else }no%{ endif }"\nafter = 2')).toEqual([
    ['message', 'propertyName'],
    ['"', 'string'],
    ['if', 'keyword'],
    ['name', 'variableName'],
    ['""', 'string'],
    ['yes', 'string'],
    ['else', 'keyword'],
    ['no', 'string'],
    ['endif', 'keyword'],
    ['"', 'string'],
    ['after', 'propertyName'],
    ['2', 'number'],
  ]);
});

it.each([
  { marker: '<<EOT', closing: 'EOT' },
  { marker: '<<-EOT', closing: '  EOT' },
])('highlights $marker heredocs and resumes code after their delimiter', ({ marker, closing }) => {
  const result = tokens(`message = ${marker}\nhello \${var.name}\n$\${literal} %%{literal}\n${closing}\nafter = 2`);
  expect(result).toEqual([
    ['message', 'propertyName'],
    [marker, 'string'],
    ['hello ', 'string'],
    ['var', 'variableName'],
    ['name', 'variableName'],
    ['$${literal} %%{literal}', 'string'],
    [closing, 'string'],
    ['after', 'propertyName'],
    ['2', 'number'],
  ]);
});

it('keeps indented or partial delimiter matches inside an unindented heredoc', () => {
  expect(tokens('message = <<END\n  END\nFRIEND\nEND\nafter = 3.5e-2')).toEqual([
    ['message', 'propertyName'],
    ['<<END', 'string'],
    ['  END', 'string'],
    ['FRIEND', 'string'],
    ['END', 'string'],
    ['after', 'propertyName'],
    ['3.5e-2', 'number'],
  ]);
});
