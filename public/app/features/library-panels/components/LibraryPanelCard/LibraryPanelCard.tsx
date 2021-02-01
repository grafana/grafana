import React, { useState } from 'react';
import { Icon, IconButton, stylesFactory, TagList, ConfirmModal, Tooltip, useStyles } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export interface LibraryPanelCardProps {
  id: number;
  uid: string;
  model: any;
  title: string;
  connectedDashboards: number[];
  varCount: number;
  lastEdited?: string;
  lastAuthor?: string;
  avatarUrl?: string;
  onClick?: () => void;
  onDelete?: () => void;
}

export const LibraryPanelCard: React.FC<LibraryPanelCardProps> = ({
  title,
  connectedDashboards,
  varCount,
  lastEdited,
  lastAuthor,
  children,
  onClick,
  onDelete,
}) => {
  const styles = useStyles(getStyles);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  const onDeletePanel = () => {
    onDelete?.();
    setShowDeletionModal(false);
  };

  return (
    <>
      <div className={styles.panelCard}>
        <div className={styles.cardHeader}>
          <Icon className={styles.panelIcon} name="book-open" />
          <div className={styles.wrapper}>
            <div className={styles.panelDetails}>
              <span>{title}</span>
              <div className={styles.panelFigures} onClick={onClick}>
                <span>Reusable panel</span>
                <Tooltip content="Connected dashboards" placement="bottom">
                  <div className={styles.tooltip}>
                    <Icon name="apps" className={styles.detailIcon} />
                    {connectedDashboards.length}
                  </div>
                </Tooltip>

                <Tooltip content="Variables used" placement="bottom">
                  <div className={styles.tooltip}>
                    <Icon name="x" className={styles.detailIcon} />
                    {varCount}
                  </div>
                </Tooltip>

                <span>
                  Last edited {lastEdited} by {lastAuthor}
                </span>
              </div>
            </div>
            <div>
              <TagList className={styles.tagList} tags={['associated panel tag']} />
            </div>
          </div>
        </div>
        <div className={styles.cardControls}>
          {children}
          <div className={styles.secondaryActions}>
            <IconButton name="clipboard-alt" tooltip="Copy panel" tooltipPlacement="bottom" />
            <IconButton
              name="trash-alt"
              tooltip="Delete panel"
              tooltipPlacement="bottom"
              onClick={() => setShowDeletionModal(true)}
            />
            <IconButton name="star" tooltip="Favorite panel" tooltipPlacement="bottom" />
          </div>
        </div>
      </div>
      {showDeletionModal && (
        <ConfirmModal
          isOpen={showDeletionModal}
          icon="trash-alt"
          title="Delete library panel"
          body="Do you want to delete this panel?"
          confirmText="Delete"
          onConfirm={onDeletePanel}
          onDismiss={() => setShowDeletionModal(false)}
        />
      )}
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    tooltip: css`
      display: inline;
    `,
    detailIcon: css`
      margin-right: 0.5ch;
    `,
    panelCard: css`
      background: ${theme.colors.bg2};
    `,
    panelIcon: css`
      margin-right: ${theme.spacing.md};
    `,
    panelDetails: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
    `,
    cardHeader: css`
      display: flex;
      padding: ${theme.spacing.sm};
    `,
    cardControls: css`
      margin-top: ${theme.spacing.sm};
      margin-bottom: ${theme.spacing.sm};
      margin-left: ${theme.spacing.md};
      margin-right: ${theme.spacing.md};
      padding-top: ${theme.spacing.sm};
      padding-left: ${theme.spacing.lg};
      border-top: 1px solid #343b40;
      display: flex;
    `,
    tagList: css`
      align-self: center;
    `,
    secondaryActions: css`
      display: flex;
      margin-left: auto;
      align-items: center;
      gap: ${theme.spacing.sm};
    `,
    panelFigures: css`
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.lineHeight.sm};

      > :not(:first-child):before {
        content: '|';
        padding-left: 1ch;
        padding-right: 1ch;
      }
    `,
    push: css`
      margin-left: auto;
    `,
    buttonMargin: css`
      margin-right: ${theme.spacing.sm};
    `,
    wrapper: css`
      display: flex;
      justify-content: space-between;
      width: 100%;
      flex-wrap: wrap;
      row-gap: ${theme.spacing.sm};
    `,
    grower: css`
      flex-grow: 3;
    `,
    modalButtonWrapper: css`
      display: flex;
      gap: ${theme.spacing.sm};
    `,
  };
});
