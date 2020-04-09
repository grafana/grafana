import React, { useState } from 'react';
import { renderOrCallToRender, HorizontalGroup, Icon, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { useUpdateEffect } from 'react-use';

interface QueryOperationRowProps {
  title?: ((props: { isOpen: boolean }) => React.ReactNode) | React.ReactNode;
  actions?:
    | ((props: { isOpen: boolean; openRow: () => void; closeRow: () => void }) => React.ReactNode)
    | React.ReactNode;
  onOpen?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
}

export const QueryOperationRow: React.FC<QueryOperationRowProps> = ({
  children,
  actions,
  title,
  onClose,
  onOpen,
}: QueryOperationRowProps) => {
  const [isContentVisible, setIsContentVisible] = useState(true);
  const theme = useTheme();
  const styles = getQueryOperationRowStyles(theme);

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

  const titleElement = title && renderOrCallToRender(title, { isOpen: isContentVisible });
  const actionsElement =
    actions &&
    renderOrCallToRender(actions, {
      isOpen: isContentVisible,
      openRow: () => {
        setIsContentVisible(true);
      },
      closeRow: () => {
        setIsContentVisible(false);
      },
    });

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <HorizontalGroup justify="space-between">
          <div className={styles.titleWrapper} onClick={() => setIsContentVisible(!isContentVisible)}>
            <Icon name={isContentVisible ? 'angle-down' : 'angle-right'} className={styles.collapseIcon} />
            {title && <span className={styles.title}>{titleElement}</span>}
          </div>
          {actions && <div>{actionsElement}</div>}
        </HorizontalGroup>
      </div>
      {isContentVisible && <div className={styles.content}>{children}</div>}
    </div>
  );
};

const getQueryOperationRowStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = theme.isLight ? theme.colors.gray85 : theme.colors.gray25;

  return {
    wrapper: css`
      margin-bottom: ${theme.spacing.formSpacingBase * 2}px;
    `,
    header: css`
      padding: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
      border: 1px solid ${borderColor};
      background: ${theme.colors.pageBg};
    `,
    collapseIcon: css`
      color: ${theme.colors.textWeak};
    `,
    titleWrapper: css`
      display: flex;
      align-items: center;
      cursor: pointer;
    `,

    title: css`
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.blue95};
      margin-left: ${theme.spacing.sm};
    `,
    content: css`
      border: 1px solid ${borderColor};
      margin-top: -1px;
      background: ${theme.colors.pageBg};
      margin-left: ${theme.spacing.xl};
      border-top: 1px solid ${theme.colors.pageBg};
      border-radis: 0 ${theme.border.radius.sm};
      padding: 0 ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.lg};
    `,
  };
});

QueryOperationRow.displayName = 'QueryOperationRow';
