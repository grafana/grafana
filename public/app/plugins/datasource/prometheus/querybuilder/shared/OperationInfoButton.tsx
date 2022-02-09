import { css } from '@emotion/css';
import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { FlexItem } from '@grafana/experimental';
import { Button, Portal, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { usePopper } from 'react-popper';
import { useToggle } from 'react-use';
import { QueryBuilderOperation, QueryBuilderOperationDef } from './types';

export interface Props {
  operation: QueryBuilderOperation;
  def: QueryBuilderOperationDef;
}

export const OperationInfoButton = React.memo<Props>(({ def, operation }) => {
  const styles = useStyles2(getStyles);
  const [popperTrigger, setPopperTrigger] = useState<HTMLButtonElement | null>(null);
  const [popover, setPopover] = useState<HTMLDivElement | null>(null);
  const [isOpen, toggleIsOpen] = useToggle(false);

  const popper = usePopper(popperTrigger, popover, {
    placement: 'top',
    modifiers: [
      { name: 'arrow', enabled: true },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          rootBoundary: 'viewport',
        },
      },
    ],
  });

  return (
    <>
      <Button
        ref={setPopperTrigger}
        icon="info-circle"
        size="sm"
        variant="secondary"
        fill="text"
        onClick={toggleIsOpen}
      />
      {isOpen && (
        <Portal>
          <div ref={setPopover} style={popper.styles.popper} {...popper.attributes.popper} className={styles.docBox}>
            <div className={styles.docBoxHeader}>
              <span>{def.renderer(operation, def, '<expr>')}</span>
              <FlexItem grow={1} />
              <Button icon="times" onClick={toggleIsOpen} fill="text" variant="secondary" title="Remove operation" />
            </div>
            <div
              className={styles.docBoxBody}
              dangerouslySetInnerHTML={{ __html: getOperationDocs(def, operation) }}
            ></div>
          </div>
        </Portal>
      )}
    </>
  );
});

OperationInfoButton.displayName = 'OperationDocs';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    docBox: css({
      overflow: 'hidden',
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.strong}`,
      boxShadow: theme.shadows.z2,
      maxWidth: '600px',
      padding: theme.spacing(1),
      borderRadius: theme.shape.borderRadius(),
      zIndex: theme.zIndex.tooltip,
    }),
    docBoxHeader: css({
      fontSize: theme.typography.h5.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      paddingBottom: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    docBoxBody: css({
      // The markdown paragraph has a marginBottom this removes it
      marginBottom: theme.spacing(-1),
      color: theme.colors.text.secondary,
    }),
    signature: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    dropdown: css({
      opacity: 0,
      color: theme.colors.text.secondary,
    }),
  };
};
function getOperationDocs(def: QueryBuilderOperationDef, op: QueryBuilderOperation): string {
  return renderMarkdown(def.explainHandler ? def.explainHandler(op, def) : def.documentation ?? 'no docs');
}
