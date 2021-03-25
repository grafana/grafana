import React, { useState } from 'react';
import { Card, Icon, IconButton, Tooltip, useStyles } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { LibraryPanelDTO } from '../../types';
import { DeleteLibraryPanelModal } from '../DeleteLibraryPanelModal/DeleteLibraryPanelModal';

export interface LibraryPanelCardProps {
  libraryPanel: LibraryPanelDTO;
  onClick?: (panel: LibraryPanelDTO) => void;
  onDelete?: (panel: LibraryPanelDTO) => void;
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
    onDelete?.(libraryPanel);
    setShowDeletionModal(false);
  };

  return (
    <>
      <Card heading={libraryPanel.name} onClick={onClick ? () => onClick(libraryPanel) : undefined}>
        <Card.Figure>
          <Icon className={styles.panelIcon} name="book-open" size="xl" />
        </Card.Figure>
        <Card.Meta>
          <span>Reusable panel</span>
          <Tooltip content="Connected dashboards" placement="bottom">
            <div className={styles.tooltip}>
              <Icon name="apps" className={styles.detailIcon} />
              {libraryPanel.meta.connectedDashboards}
            </div>
          </Tooltip>
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
        <DeleteLibraryPanelModal
          libraryPanel={libraryPanel}
          onConfirm={onDeletePanel}
          onDismiss={() => setShowDeletionModal(false)}
        />
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    tooltip: css`
      display: inline;
    `,
    detailIcon: css`
      margin-right: 0.5ch;
    `,
    panelIcon: css`
      color: ${theme.colors.textWeak};
    `,
    tagList: css`
      align-self: center;
    `,
  };
};
