import React, { useState } from 'react';
import { Icon, IconButton, stylesFactory, ConfirmModal, Tooltip, useStyles, Card } from '@grafana/ui';
import { css } from 'emotion';
import pick from 'lodash/pick';
import { GrafanaTheme } from '@grafana/data';
import { copyPanel } from 'app/features/dashboard/utils/panel';
import { LibraryPanelDTO } from 'app/core/services/library_srv';

export interface LibraryPanelCardProps {
  libraryPanel: LibraryPanelDTO;
  onClick?: () => void;
  onDelete?: () => void;
  formatDate?: (dateString: string) => string;
}

export const LibraryPanelCard: React.FC<LibraryPanelCardProps & { children: JSX.Element | JSX.Element[] }> = ({
  libraryPanel,
  children,
  onDelete,
  formatDate,
}) => {
  const styles = useStyles(getStyles);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  const onDeletePanel = () => {
    onDelete?.();
    setShowDeletionModal(false);
  };

  return (
    <>
      <Card heading={libraryPanel.name}>
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
        <Card.Actions>{children}</Card.Actions>
        <Card.SecondaryActions>
          <IconButton
            name="clipboard-alt"
            tooltip="Copy panel"
            tooltipPlacement="bottom"
            onClick={() =>
              copyPanel({ ...libraryPanel.model, libraryPanel: pick(libraryPanel, 'uid', 'name', 'meta') })
            }
          />
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
