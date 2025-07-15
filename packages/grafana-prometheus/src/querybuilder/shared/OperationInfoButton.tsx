// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/OperationInfoButton.tsx
import { css } from '@emotion/css';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { memo, useState } from 'react';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FlexItem } from '@grafana/plugin-ui';
import { Button, Portal, useStyles2 } from '@grafana/ui';

import { QueryBuilderOperation, QueryBuilderOperationDef } from './types';

interface Props {
  operation: QueryBuilderOperation;
  def: QueryBuilderOperationDef;
}

export const OperationInfoButton = memo<Props>(({ def, operation }) => {
  const styles = useStyles2(getStyles);
  const [show, setShow] = useState(false);

  // the order of middleware is important!
  const middleware = [
    offset(16),
    flip({
      fallbackAxisSideDirection: 'end',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: show,
    placement: 'top',
    onOpenChange: setShow,
    middleware,
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, click]);

  return (
    <>
      <Button
        title={t(
          'grafana-prometheus.querybuilder.operation-info-button.title-click-to-show-description',
          'Click to show description'
        )}
        ref={refs.setReference}
        icon="info-circle"
        size="sm"
        variant="secondary"
        fill="text"
        {...getReferenceProps()}
      />
      {show && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()} className={styles.docBox}>
            <div className={styles.docBoxHeader}>
              <span>{def.renderer(operation, def, '<expr>')}</span>
              <FlexItem grow={1} />
              <Button
                icon="times"
                onClick={() => setShow(false)}
                fill="text"
                variant="secondary"
                title={t(
                  'grafana-prometheus.querybuilder.operation-info-button.title-remove-operation',
                  'Remove operation'
                )}
              />
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
      background: theme.colors.background.elevated,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z3,
      maxWidth: '600px',
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
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
  };
};

function getOperationDocs(def: QueryBuilderOperationDef, op: QueryBuilderOperation): string {
  return renderMarkdown(def.explainHandler ? def.explainHandler(op, def) : (def.documentation ?? 'no docs'));
}
