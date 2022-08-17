import React from 'react';
import { InlineField } from '@grafana/ui';
import { QueryBuilderFieldProps } from './types';
import { onBuilderChange } from '.';
import uniqueId from 'lodash/uniqueId';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-hjson';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-terminal';

interface Props extends QueryBuilderFieldProps {
  namesFieldName: string;
  typesFieldName: string;
  rowsFieldName: string;
}

const encodeInline = (names: string[], types: string[], rows: string[][]): string => {
  let inline = '';
  if (undefined !== names && names.length > 0) {
    for (let i in names) {
      inline += names[i] + ':' + types[i] + ',';
    }
    inline = inline.slice(0, -1) + '\n';
    for (let row of rows) {
      for (let col of row) {
        inline += col + ',';
      }
      inline = inline.slice(0, -1) + '\n';
    }
  }
  return inline;
};

const decodeInline = (inline: string): [string[], string[], string[][]] => {
  const lines = inline.split('\n');
  const header = lines[0];
  const fields = header.split(',');
  let names = [];
  let types = [];
  let rows = [];
  for (let field of fields) {
    let name_type = field.split(':');
    if (name_type[0] !== '' && name_type[1] !== undefined) {
      names.push(name_type[0]);
      types.push(name_type[1]);
    }
  }
  for (let line of lines.slice(1)) {
    rows.push(line.split(','));
  }
  return [names, types, rows];
};

export const Table = (props: Props) => {
  const onChange = (value: string) => {
    const [names, types, rows] = decodeInline(value);
    onBuilderChange(props, { columnNames: names, columnTypes: types, rows: rows });
  };
  return (
    <InlineField label={props.label} grow>
      <AceEditor
        name={uniqueId()}
        placeholder={props.description}
        mode="text"
        theme="twilight"
        onChange={onChange}
        width="100%"
        fontSize={14}
        showPrintMargin={true}
        showGutter={true}
        highlightActiveLine={true}
        defaultValue={encodeInline(
          props.options.builder[props.namesFieldName],
          props.options.builder[props.typesFieldName],
          props.options.builder[props.rowsFieldName]
        )}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: false,
          showLineNumbers: true,
          tabSize: 2,
        }}
      />
    </InlineField>
  );
};
