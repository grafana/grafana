import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, Link, useStyles2 } from '@grafana/ui';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { PanelTypeCard } from 'app/features/panel/components/VizTypePicker/PanelTypeCard';

import { LibraryElementDTO } from '../../types';
import { DeleteLibraryPanelModal } from '../DeleteLibraryPanelModal/DeleteLibraryPanelModal';

export interface LibraryPanelCardProps {
  libraryPanel: LibraryElementDTO;
  onClick: (panel: LibraryElementDTO) => void;
  onDelete?: (panel: LibraryElementDTO) => void;
  showSecondaryActions?: boolean;
}

type Props = LibraryPanelCardProps & { children?: JSX.Element | JSX.Element[] };

export const LibraryPanelCard = ({ libraryPanel, onClick, onDelete, showSecondaryActions }: Props) => {
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  const onDeletePanel = () => {
    onDelete?.(libraryPanel);
    setShowDeletionModal(false);
  };

  const panelPlugin = config.panels[libraryPanel.model.type] ?? getPanelPluginNotFound(libraryPanel.model.type).meta;

  return (
    <>
      <PanelTypeCard
        isCurrent={false}
        title={libraryPanel.name}
        description={libraryPanel.description}
        plugin={panelPlugin}
        onClick={() => onClick?.(libraryPanel)}
        onDelete={showSecondaryActions ? () => setShowDeletionModal(true) : undefined}
      >
        <FolderLink libraryPanel={libraryPanel} />
      </PanelTypeCard>
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

interface FolderLinkProps {
  libraryPanel: LibraryElementDTO;
}

function FolderLink({ libraryPanel }: FolderLinkProps): ReactElement | null {
  const styles = useStyles2(getStyles);

  if (!libraryPanel.meta?.folderUid && !libraryPanel.meta?.folderName) {
    return null;
  }

  if (!libraryPanel.meta.folderUid) {
    return (
      <span className={styles.metaContainer}>
        <Icon name={'folder'} size="sm" />
        <span>{libraryPanel.meta.folderName}</span>
      </span>
    );
  }

  return (
    <span className={styles.metaContainer}>
      <Link href={`/dashboards/f/${libraryPanel.meta.folderUid}`}>
        <Icon name={'folder-upload'} size="sm" />
        <span>{libraryPanel.meta.folderName}</span>
      </Link>
    </span>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    metaContainer: css`
      display: flex;
      align-items: center;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      padding-top: ${theme.spacing(0.5)};

      svg {
        margin-right: ${theme.spacing(0.5)};
        margin-bottom: 3px;
      }
    `,
  };
}
