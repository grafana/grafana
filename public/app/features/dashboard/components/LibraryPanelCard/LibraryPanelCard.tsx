import React, { useState } from 'react';
import { useTheme, Icon, IconButton, stylesFactory, TagList, ConfirmModal } from '@grafana/ui';
import { css, cx } from 'emotion';
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
  const theme = useTheme();
  const styles = getStyles(theme);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  const onDeletePanel = () => {
    onDelete?.();
    setShowDeletionModal(false);
  };

  return (
    <>
      <div className={cx(styles.panelCard)}>
        <div className={cx(styles.cardHeader)}>
          <Icon className={cx(styles.panelIcon)} name="book-open" />
          <div className={cx(styles.wrapper)}>
            <div className={cx(styles.panelDetails)}>
              <span>{title}</span>
              <div className={cx(styles.panelFigures)} onClick={onClick}>
                <span>Reusable panel</span>
                <Icon name="apps" className={cx(styles.detailIcon)} />
                {connectedDashboards.length}
                <Icon name="x" className={cx(styles.detailIcon)} />
                {varCount}
                <span>
                  Last edited {lastEdited} by {lastAuthor}
                </span>
              </div>
            </div>
            <div>
              <TagList className={cx(styles.tagList)} tags={['associated panel tag']} />
            </div>
          </div>
        </div>
        <div className={cx(styles.cardControls)}>
          {children}
          <div className={cx(styles.secondaryActions)}>
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
    detailIcon: css`
      margin-right: 0.5ch;
    `,
    panelCard: css`
      background: ${theme.colors.bg2};
    `,
    panelIcon: css`
      margin-right: 13px;
    `,
    panelDetails: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
    `,
    cardHeader: css`
      display: flex;
      padding: 10px;
    `,
    cardControls: css`
      margin-top: 11px;
      margin-bottom: 11px;
      margin-left: 16px;
      margin-right: 16px;
      padding-top: 11px;
      padding-left: 22px;
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
      gap: 12px;
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
      margin-right: 10px;
    `,
    wrapper: css`
      display: flex;
      justify-content: space-between;
      width: 100%;
      flex-wrap: wrap;
      row-gap: 10px;
    `,
    grower: css`
      flex-grow: 3;
    `,
    modalButtonWrapper: css`
      display: flex;
      gap: 10px;
    `,
  };
});
