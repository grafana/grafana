import React, { useState, useCallback } from 'react';
import { Icon, renderOrCallToRender, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useUpdateEffect } from 'react-use';
import { Draggable } from 'react-beautiful-dnd';

interface QueryOperationRowProps {
  index: number;
  id: string;
  title?: string;
  headerElement?: QueryOperationRowRenderProp;
  actions?: QueryOperationRowRenderProp;
  onOpen?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  isOpen?: boolean;
  draggable?: boolean;
  disabled?: boolean;
}

export type QueryOperationRowRenderProp = ((props: QueryOperationRowRenderProps) => React.ReactNode) | React.ReactNode;

export interface QueryOperationRowRenderProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const QueryOperationRow: React.FC<QueryOperationRowProps> = ({
  children,
  actions,
  title,
  headerElement,
  onClose,
  onOpen,
  isOpen,
  disabled,
  draggable,
  index,
  id,
}: QueryOperationRowProps) => {
  const [isContentVisible, setIsContentVisible] = useState(isOpen !== undefined ? isOpen : true);
  const theme = useTheme();
  const styles = getQueryOperationRowStyles(theme);
  const onRowToggle = useCallback(() => {
    setIsContentVisible(!isContentVisible);
  }, [isContentVisible, setIsContentVisible]);

  useUpdateEffect(() => {
    if (isContentVisible) {
      if (onOpen) {
        onOpen();
      }
    } else {
      if (onClose) {
        onClose();
      }
    }
  }, [isContentVisible]);

  const renderPropArgs: QueryOperationRowRenderProps = {
    isOpen: isContentVisible,
    onOpen: () => {
      setIsContentVisible(true);
    },
    onClose: () => {
      setIsContentVisible(false);
    },
  };

  const titleElement = title && renderOrCallToRender(title, renderPropArgs);
  const actionsElement = actions && renderOrCallToRender(actions, renderPropArgs);
  const headerElementRendered = headerElement && renderOrCallToRender(headerElement, renderPropArgs);

  const rowHeader = (
    <div className={styles.header}>
      <Icon
        name={isContentVisible ? 'angle-down' : 'angle-right'}
        className={styles.collapseIcon}
        onClick={onRowToggle}
      />
      {title && (
        <div className={styles.titleWrapper} onClick={onRowToggle} aria-label="Query operation row title">
          <div className={cx(styles.title, disabled && styles.disabled)}>{titleElement}</div>
        </div>
      )}
      {headerElementRendered}
      {actions && <div>{actionsElement}</div>}
      {draggable && (
        <Icon title="Drag and drop to reorder" name="draggabledots" size="lg" className={styles.dragIcon} />
      )}
    </div>
  );

  if (draggable) {
    return (
      <Draggable draggableId={id} index={index}>
        {(provided) => {
          return (
            <>
              <div ref={provided.innerRef} className={styles.wrapper} {...provided.draggableProps}>
                <div {...provided.dragHandleProps}>{rowHeader}</div>
                {isContentVisible && <div className={styles.content}>{children}</div>}
              </div>
            </>
          );
        }}
      </Draggable>
    );
  }

  return (
    <div className={styles.wrapper}>
      {rowHeader}
      {isContentVisible && <div className={styles.content}>{children}</div>}
    </div>
  );
};

const getQueryOperationRowStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing.md};
    `,
    header: css`
      padding: ${theme.spacing.xs} ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
      background: ${theme.colors.bg2};
      min-height: ${theme.spacing.formInputHeight}px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      white-space: nowrap;

      &:focus {
        outline: none;
      }
    `,
    dragIcon: css`
      cursor: drag;
      color: ${theme.colors.textWeak};
      &:hover {
        color: ${theme.colors.text};
      }
    `,
    collapseIcon: css`
      color: ${theme.colors.textWeak};
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
      margin-right: ${theme.spacing.sm};
    `,
    title: css`
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.textBlue};
      margin-left: ${theme.spacing.sm};
      overflow: hidden;
    `,
    content: css`
      margin-top: ${theme.spacing.inlineFormMargin};
      margin-left: ${theme.spacing.lg};
    `,
    disabled: css`
      color: ${theme.colors.textWeak};
    `,
  };
});

QueryOperationRow.displayName = 'QueryOperationRow';
