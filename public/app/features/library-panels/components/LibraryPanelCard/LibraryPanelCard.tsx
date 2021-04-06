import React, { useState } from 'react';
import { PanelPluginMeta } from '@grafana/data';
import { LibraryPanelDTO } from '../../types';
import { config } from '@grafana/runtime';
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
  //const styles = useStyles(getStyles);
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
      />
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

// const getStyles = (theme: GrafanaTheme) => {
//   return {
//     tooltip: css`
//       display: inline;
//     `,
//     detailIcon: css`
//       margin-right: 0.5ch;
//     `,
//     panelIcon: css`
//       color: ${theme.colors.textWeak};
//     `,
//     tagList: css`
//       align-self: center;
//     `,
//   };
// };
