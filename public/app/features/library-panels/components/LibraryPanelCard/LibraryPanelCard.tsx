import React, { useState } from 'react';
import { Icon, IconButton, stylesFactory, ConfirmModal, Tooltip, useStyles, Card } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { LibraryPanelDTO } from '../../state/api';

export interface LibraryPanelCardProps {
  libraryPanel: LibraryPanelDTO;
  onClick?: (panel: LibraryPanelDTO) => void;
  onDelete?: () => void;
  showSecondaryActions?: boolean;
  formatDate?: (dateString: string) => string;
}

export const LibraryPanelCard: React.FC<LibraryPanelCardProps & { children?: JSX.Element | JSX.Element[] }> = ({
  libraryPanel,
  children,
  onClick,
  onDelete,
  formatDate,
  showSecondaryActions,
}) => {
  const styles = useStyles(getStyles);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  const onDeletePanel = () => {
    onDelete?.();
    setShowDeletionModal(false);
  };

  return (
    <>
      <Card heading={libraryPanel.name} onClick={onClick ? () => onClick(libraryPanel) : undefined}>
        <Card.Figure>
          <Icon className={styles.panelIcon} name="book-open" />
        </Card.Figure>
        <Card.Meta>
          <span>Reusable panel</span>
          <Tooltip content="Connected dashboards" placement="bottom">
            <div className={styles.tooltip}>
              <Icon name="apps" className={styles.detailIcon} />
              {libraryPanel.meta.connectedDashboards}
            </div>
          </Tooltip>

          {/*
          Commenting this out as obtaining the number of variables used by a panel
          isn't implemetned yet.
          <Tooltip content="Variables used" placement="bottom">
            <div className={styles.tooltip}>
              <Icon name="x" className={styles.detailIcon} />
              {varCount}
            </div>
          </Tooltip> */}

          <span>
            Last edited {formatDate?.(libraryPanel.meta.updated ?? '') ?? libraryPanel.meta.updated} by{' '}
            {libraryPanel.meta.updatedBy.name}
          </span>
        </Card.Meta>
        {/*
        Commenting this out as tagging isn't implemented yet.
        <Card.Tags>
          <TagList className={styles.tagList} tags={['associated panel tag']} />
        </Card.Tags> */}
        {children && <Card.Actions>{children}</Card.Actions>}
        {showSecondaryActions && (
          <Card.SecondaryActions>
            <IconButton
              name="trash-alt"
              tooltip="Delete panel"
              tooltipPlacement="bottom"
              onClick={() => setShowDeletionModal(true)}
            />
            {/*
          Commenting this out as panel favoriting hasn't been implemented yet.
          <IconButton name="star" tooltip="Favorite panel" tooltipPlacement="bottom" />
          */}
          </Card.SecondaryActions>
        )}
      </Card>
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
    panelIcon: css`
      margin-right: ${theme.spacing.md};
    `,
    tagList: css`
      align-self: center;
    `,
  };
});
