import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Button, Toggletip, useStyles2 } from '@grafana/ui';

import { QueryBuilderOperation, QueryBuilderOperationDef } from './types';

export interface Props {
  operation: QueryBuilderOperation;
  def: QueryBuilderOperationDef;
}

export const OperationInfoButton = React.memo<Props>(({ def, operation }) => {
  const styles = useStyles2(getStyles);

  return (
    <Toggletip
      title={<div className={styles.docBoxHeader}>{def.renderer(operation, def, '<expr>')}</div>}
      content={
        <div className={styles.docBoxBody} dangerouslySetInnerHTML={{ __html: getOperationDocs(def, operation) }} />
      }
    >
      <Button title="Click to show description" icon="info-circle" size="sm" variant="secondary" fill="text" />
    </Toggletip>
  );
});

OperationInfoButton.displayName = 'OperationDocs';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    docBoxHeader: css({
      fontSize: theme.typography.h5.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      display: 'flex',
      alignItems: 'center',
    }),
    docBoxBody: css({
      // The markdown paragraph has a marginBottom this removes it
      marginBottom: theme.spacing(-1),
      color: theme.colors.text.secondary,
    }),
  };
};
function getOperationDocs(def: QueryBuilderOperationDef, op: QueryBuilderOperation): string {
  return renderMarkdown(def.explainHandler ? def.explainHandler(op, def) : def.documentation ?? 'no docs');
}
