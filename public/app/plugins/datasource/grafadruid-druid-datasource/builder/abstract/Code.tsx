import React from 'react';
import { InlineField } from '@grafana/ui';
import { QueryBuilderFieldProps } from './types';
import { onBuilderChange } from '.';
import uniqueId from 'lodash/uniqueId';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-hjson';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-twilight';

interface Props extends QueryBuilderFieldProps {
  lang: string;
}

export const Code = (props: Props) => {
  const onChange = (value: string) => {
    onBuilderChange(props, value);
  };
  return (
    <InlineField label={props.label} grow>
      <AceEditor
        name={uniqueId()}
        placeholder={props.description}
        mode={props.lang}
        theme="twilight"
        onChange={onChange}
        width="100%"
        fontSize={14}
        wrapEnabled={true}
        showPrintMargin={true}
        showGutter={true}
        highlightActiveLine={true}
        defaultValue={props.options.builder}
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
