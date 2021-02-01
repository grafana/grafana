import React, { useState } from 'react';
import { Icon, IconButton, stylesFactory, TagList, ConfirmModal, Tooltip, useStyles, Card } from '@grafana/ui';
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

export const LibraryPanelCard: React.FC<LibraryPanelCardProps & { children: JSX.Element | JSX.Element[] }> = ({
  title,
  connectedDashboards,
  varCount,
  lastEdited,
  lastAuthor,
  children,
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
      <Card heading={title}>
        <Card.Figure>
          <Icon className={styles.panelIcon} name="book-open" />
        </Card.Figure>
        <Card.Meta>
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
        </Card.Meta>
        <Card.Tags>
          <TagList className={styles.tagList} tags={['associated panel tag']} />
        </Card.Tags>
        <Card.Actions>{children}</Card.Actions>
        <Card.SecondaryActions>
          <IconButton name="clipboard-alt" tooltip="Copy panel" tooltipPlacement="bottom" />
          <IconButton
            name="trash-alt"
            tooltip="Delete panel"
            tooltipPlacement="bottom"
            onClick={() => setShowDeletionModal(true)}
          />
          <IconButton name="star" tooltip="Favorite panel" tooltipPlacement="bottom" />
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
