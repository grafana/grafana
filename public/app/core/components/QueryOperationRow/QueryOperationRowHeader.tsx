import { css, cx } from '@emotion/css';
import React, { MouseEventHandler } from 'react';
import { DraggableProvidedDragHandleProps } from 'react-beautiful-dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface QueryOperationRowHeaderProps {
  actionsElement?: React.ReactNode;
  disabled?: boolean;
  draggable: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  headerElement?: React.ReactNode;
  isContentVisible: boolean;
  onRowToggle: () => void;
  reportDragMousePosition: MouseEventHandler<HTMLDivElement>;
  titleElement?: React.ReactNode;
}

export const QueryOperationRowHeader: React.FC<QueryOperationRowHeaderProps> = ({
  actionsElement,
  disabled,
  draggable,
  dragHandleProps,
  headerElement,
  isContentVisible,
  onRowToggle,
  reportDragMousePosition,
  titleElement,
}: QueryOperationRowHeaderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.header}>
      <div className={styles.column}>
        <Icon
          name={isContentVisible ? 'angle-down' : 'angle-right'}
          className={styles.collapseIcon}
          onClick={onRowToggle}
        />
        {titleElement && (
          <div className={styles.titleWrapper} onClick={onRowToggle} aria-label="Query operation row title">
            <div className={cx(styles.title, disabled && styles.disabled)}>{titleElement}</div>
          </div>
        )}
        {headerElement}
      </div>

      <div className={styles.column}>
        {actionsElement}
        {draggable && (
          <Icon
            title="Drag and drop to reorder"
            name="draggabledots"
            size="lg"
            className={styles.dragIcon}
            onMouseMove={reportDragMousePosition}
            {...dragHandleProps}
          />
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css`
    label: Header;
    padding: ${theme.spacing(0.5, 0.5)};
    border-radius: ${theme.shape.borderRadius(1)};
    background: ${theme.colors.background.secondary};
    min-height: ${theme.spacing(4)};
    display: grid;
    grid-template-columns: minmax(100px, max-content) min-content;
    align-items: center;
    justify-content: space-between;
    white-space: nowrap;

    &:focus {
      outline: none;
    }
  `,
  column: css`
    label: Column;
    display: flex;
    align-items: center;
  `,
  dragIcon: css`
    cursor: grab;
    color: ${theme.colors.text.disabled};
    margin: ${theme.spacing(0, 0.5)};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
  collapseIcon: css`
    color: ${theme.colors.text.disabled};
    cursor: pointer;
    &:hover {
      color: ${theme.colors.text};
    }
  `,
  titleWrapper: css`
    display: flex;
    align-items: center;
    flex-grow: 1;
    cursor: pointer;
    overflow: hidden;
    margin-right: ${theme.spacing(0.5)};
  `,
  title: css`
    font-weight: ${theme.typography.fontWeightBold};
    color: ${theme.colors.text.link};
    margin-left: ${theme.spacing(0.5)};
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  disabled: css`
    color: ${theme.colors.text.disabled};
  `,
});

QueryOperationRowHeader.displayName = 'QueryOperationRowHeader';
