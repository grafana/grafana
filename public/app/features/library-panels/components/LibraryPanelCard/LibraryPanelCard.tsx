import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaThemeV2, PanelPluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { LibraryPanelDTO } from '../../types';
import { PanelTypeCard } from 'app/features/dashboard/components/VizTypePicker/PanelTypeCard';
import { DeleteLibraryPanelModal } from '../DeleteLibraryPanelModal/DeleteLibraryPanelModal';

export interface LibraryPanelCardProps {
  libraryPanel: LibraryPanelDTO;
  onClick: (panel: LibraryPanelDTO) => void;
  onDelete?: (panel: LibraryPanelDTO) => void;
  showSecondaryActions?: boolean;
}

export const LibraryPanelCard: React.FC<LibraryPanelCardProps & { children?: JSX.Element | JSX.Element[] }> = ({
  libraryPanel,
  onClick,
  onDelete,
  showSecondaryActions,
}) => {
  const styles = useStyles2(getStyles);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  const onDeletePanel = () => {
    onDelete?.(libraryPanel);
    setShowDeletionModal(false);
  };

  const panelPlugin = config.panels[libraryPanel.model.type] ?? ({} as PanelPluginMeta);

  return (
    <>
      <PanelTypeCard
        isCurrent={false}
        title={libraryPanel.name}
        plugin={panelPlugin}
        onClick={() => onClick(libraryPanel)}
        onDelete={showSecondaryActions ? () => setShowDeletionModal(true) : undefined}
      >
        {libraryPanel.description ? <span className={styles.description}>{libraryPanel.description}</span> : null}
      </PanelTypeCard>
      {/* <Card heading={libraryPanel.name} onClick={}>
        <Card.Figure>
          <Icon className={styles.panelIcon} name="book-open" size="xl" />
        </Card.Figure>
        <Card.Meta>
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
        {children && <Card.Actions>{children}</Card.Actions>}
        {showSecondaryActions && (
          <Card.SecondaryActions>
            <IconButton
              name="trash-alt"
              tooltip="Delete panel"
              tooltipPlacement="bottom"
              onClick={() => setShowDeletionModal(true)}
            />
          </Card.SecondaryActions>
        )}
      </Card> */}
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

const getStyles = (theme: GrafanaThemeV2) => {
  return {
    description: css`
      label: description;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightLight};
      padding: 0 ${theme.spacing(1.25)};
      width: 100%;
    `,
    // tooltip: css`
    //   display: inline;
    // `,
    // detailIcon: css`
    //   margin-right: 0.5ch;
    // `,
    // panelIcon: css`
    //   color: ${theme.colors.textWeak};
    // `,
    // tagList: css`
    //   align-self: center;
    // `,
  };
};
