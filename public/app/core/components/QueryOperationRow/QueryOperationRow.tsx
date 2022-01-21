import React, { useCallback, useState } from 'react';
import { Icon, ReactUtils, stylesFactory, useTheme } from '@grafana/ui';
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

  const titleElement = title && ReactUtils.renderOrCallToRender(title, renderPropArgs);
  const actionsElement = actions && ReactUtils.renderOrCallToRender(actions, renderPropArgs);
  const headerElementRendered = headerElement && ReactUtils.renderOrCallToRender(headerElement, renderPropArgs);

  const rowHeader = (
    <div className={styles.header}>
      <div className={styles.column}>
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
      </div>

      <div className={styles.column}>
        {actionsElement}
        {draggable && (
          <Icon title="Drag and drop to reorder" name="draggabledots" size="lg" className={styles.dragIcon} />
        )}
      </div>
    </div>
  );

  if (draggable) {
    return (
      <Draggable draggableId={id} index={index}>
        {(provided) => {
          const dragHandleProps = { ...provided.dragHandleProps, role: 'group' }; // replace the role="button" because it causes https://dequeuniversity.com/rules/axe/4.3/nested-interactive?application=msftAI
          return (
            <>
              <div ref={provided.innerRef} className={styles.wrapper} {...provided.draggableProps}>
                <div {...dragHandleProps}>{rowHeader}</div>
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
      label: Header;
      padding: ${theme.spacing.xs} ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
      background: ${theme.colors.bg2};
      min-height: ${theme.spacing.formInputHeight}px;
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
      text-overflow: ellipsis;
    `,
    content: css`
      margin: ${theme.spacing.md};
    `,
    disabled: css`
      color: ${theme.colors.textWeak};
    `,
  };
});

QueryOperationRow.displayName = 'QueryOperationRow';
