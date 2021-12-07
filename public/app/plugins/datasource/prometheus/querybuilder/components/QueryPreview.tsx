import React from 'react';
import { PromVisualQuery } from '../types';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { promQueryModeller } from '../PromQueryModeller';
import { css } from '@emotion/css';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';

export interface Props {
  query: PromVisualQuery;
}

export function QueryPreview({ query }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <EditorFieldGroup>
      <EditorField label="Query text">
        <div className={styles.editorField} aria-label="selector">
          {promQueryModeller.renderQuery(query)}
        </div>
      </EditorField>
    </EditorFieldGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editorField: css({
      padding: theme.spacing(0.25, 1),
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
