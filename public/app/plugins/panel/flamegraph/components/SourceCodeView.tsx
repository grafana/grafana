import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, useTheme2 } from '@grafana/ui';

import { PhlareDataSource } from '../../../datasource/phlare/datasource';
import { CodeLocation } from '../../../datasource/phlare/types';

interface Props {
  datasource: PhlareDataSource;
  location: CodeLocation;
  getLabelValue: (label: string | number) => string;
  getFileNameValue: (label: string | number) => string;
}
export function SourceCodeView(props: Props) {
  const { datasource, location, getLabelValue, getFileNameValue } = props;
  const [source, setSource] = useState<string>('');
  const theme = useTheme2();
  const styles = getStyles(theme);

  useEffect(() => {
    (async () => {
      const sourceCode = await datasource.getSource(getLabelValue(location.func), getFileNameValue(location.fileName));
      setSource(sourceCode);
    })();
  }, [datasource, location, getLabelValue, getFileNameValue]);

  return (
    <CodeEditor
      value={source}
      language={'go'}
      containerStyles={styles.queryField}
      readOnly={true}
      showLineNumbers={true}
      monacoOptions={{
        fontSize: 14,
      }}
    />
  );
}

interface EditorStyles {
  queryField: string;
}

const getStyles = (theme: GrafanaTheme2): EditorStyles => {
  return {
    queryField: css`
      float: left;
      width: 50%;
      height: 100%;
    `,
  };
};
