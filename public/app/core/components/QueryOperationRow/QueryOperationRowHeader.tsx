import { css, cx } from '@emotion/css';
import { DraggableProvided } from '@hello-pangea/dnd';
import { MouseEventHandler } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, useStyles2, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface QueryOperationRowHeaderProps {
  actionsElement?: React.ReactNode;
  disabled?: boolean;
  draggable: boolean;
  collapsable?: boolean;
  dragHandleProps?: DraggableProvided['dragHandleProps'];
  headerElement?: React.ReactNode;
  isContentVisible: boolean;
  onRowToggle: () => void;
  reportDragMousePosition: MouseEventHandler<HTMLDivElement>;
  title?: string;
  id: string;
  expanderMessages?: ExpanderMessages;
}

export interface ExpanderMessages {
  open: string;
  close: string;
}

export const QueryOperationRowHeader = ({
  actionsElement,
  disabled,
  draggable,
  collapsable = true,
  dragHandleProps,
  headerElement,
  isContentVisible,
  onRowToggle,
  reportDragMousePosition,
  title,
  id,
  expanderMessages,
}: QueryOperationRowHeaderProps) => {
  const styles = useStyles2(getStyles);

  let tooltipMessage = isContentVisible
    ? t('query-operation.header.collapse-row', 'Collapse query row')
    : t('query-operation.header.expand-row', 'Expand query row');
  if (expanderMessages !== undefined && isContentVisible) {
    tooltipMessage = expanderMessages.close;
  } else if (expanderMessages !== undefined) {
    tooltipMessage = expanderMessages?.open;
  }

  const dragAndDropLabel = t('query-operation.header.drag-and-drop', 'Drag and drop to reorder');

  return (
    <div className={styles.header}>
      <div className={styles.column}>
        {collapsable && (
          <IconButton
            name={isContentVisible ? 'angle-down' : 'angle-right'}
            tooltip={tooltipMessage}
            className={styles.collapseIcon}
            onClick={onRowToggle}
            aria-expanded={isContentVisible}
            aria-controls={id}
          />
        )}
        {title && (
          // disabling the a11y rules here as the IconButton above handles keyboard interactions
          // this is just to provide a better experience for mouse users
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div className={styles.titleWrapper} onClick={onRowToggle} aria-label="Query operation row title">
            <div className={cx(styles.title, disabled && styles.disabled)}>{title}</div>
          </div>
        )}
        {headerElement}
      </div>

      <Stack gap={1} alignItems="center">
        {actionsElement}
        {draggable && (
          <div onMouseMove={reportDragMousePosition} {...dragHandleProps}>
            <Icon title={dragAndDropLabel} name="draggabledots" size="lg" className={styles.dragIcon} />
          </div>
        )}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    label: 'Header',
    padding: theme.spacing(0.5, 0.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    minHeight: theme.spacing(4),
    display: 'grid',
    gridTemplateColumns: 'minmax(100px, max-content) min-content',
    alignItems: 'center',
    justifyContent: 'space-between',
    whiteSpace: 'nowrap',

    '&:focus': {
      outline: 'none',
    },
  }),
  column: css({
    label: 'Column',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  }),
  dragIcon: css({
    cursor: 'grab',
    color: theme.colors.text.disabled,
    margin: theme.spacing(0, 0.5),
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  collapseIcon: css({
    marginLeft: theme.spacing(0.5),
    color: theme.colors.text.disabled,
  }),
  titleWrapper: css({
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1,
    cursor: 'pointer',
    overflow: 'hidden',
    marginRight: theme.spacing(0.5),
  }),
  title: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.link,
    marginLeft: theme.spacing(0.5),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  disabled: css({
    color: theme.colors.text.disabled,
  }),
});

QueryOperationRowHeader.displayName = 'QueryOperationRowHeader';
