import EditorField from 'app/plugins/datasource/cloudwatch/components/ui/EditorField';
import EditorFieldGroup from 'app/plugins/datasource/cloudwatch/components/ui/EditorFieldGroup';
import React from 'react';
import { PromVisualQuery } from '../types';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { visualQueryEngine } from '../engine';
import { css } from '@emotion/css';

export interface Props {
  query: PromVisualQuery;
}

export function QueryPreview({ query }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <EditorFieldGroup>
      <EditorField label="Query Preview">
        <div className={styles.editorField} aria-label="selector">
          {visualQueryEngine.renderQuery(query)}
        </div>
      </EditorField>
    </EditorFieldGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editorField: css`
      padding: '2px 8px';
    `,
  };
};
