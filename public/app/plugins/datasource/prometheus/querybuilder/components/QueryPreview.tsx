import React from 'react';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/experimental';
import Prism from 'prismjs';
import { promqlGrammar } from '../../promql';

export interface Props {
  query: string;
}

export function QueryPreview({ query }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const hightlighted = Prism.highlight(query, promqlGrammar, 'promql');

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Raw query">
          <div
            className={cx(styles.editorField, 'prism-syntax-highlight')}
            aria-label="selector"
            dangerouslySetInnerHTML={{ __html: hightlighted }}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editorField: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
