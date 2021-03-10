import React from 'react';
import { MonacoDiffEditor, MonacoDiffEditorProps } from 'react-monaco-editor';
import { useTheme } from '@grafana/ui';

export const DiffViewer: React.FC<MonacoDiffEditorProps> = ({ original, value, width, height, options = {} }) => {
  const theme = useTheme();
  const editorOpts = Object.assign(options, {
    renderSideBySide: false,
    readOnly: true,
  });

  return (
    <MonacoDiffEditor
      width="100%"
      height="600"
      language="json"
      original={original}
      theme={theme.isDark ? 'vs-dark' : 'vs-light'}
      value={value}
      options={editorOpts}
    />
  );
};
