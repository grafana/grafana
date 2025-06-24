import { css } from '@emotion/css';
import { ReactElement, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, Link, useStyles2 } from '@grafana/ui';
import { SkeletonComponent, attachSkeleton } from '@grafana/ui/unstable';
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

const LibraryPanelCardComponent = ({ libraryPanel, onClick, onDelete, showSecondaryActions }: Props) => {
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

const LibraryPanelCardSkeleton: SkeletonComponent<Pick<Props, 'showSecondaryActions'>> = ({
  showSecondaryActions,
  rootProps,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <PanelTypeCard.Skeleton hasDelete={showSecondaryActions} {...rootProps}>
      <Skeleton containerClassName={styles.metaContainer} width={80} />
    </PanelTypeCard.Skeleton>
  );
};

export const LibraryPanelCard = attachSkeleton(LibraryPanelCardComponent, LibraryPanelCardSkeleton);

interface FolderLinkProps {
  libraryPanel: LibraryElementDTO;
}

function FolderLink({ libraryPanel }: FolderLinkProps): ReactElement | null {
  const styles = useStyles2(getStyles);

  if (!libraryPanel.meta?.folderUid && !libraryPanel.meta?.folderName) {
    return null;
  }

  // LibraryPanels API returns folder-less library panels with an empty string folder UID
  if (!libraryPanel.meta.folderUid) {
    return (
      <span className={styles.metaContainer}>
        <Icon name={'folder'} size="sm" />
        <span>
          <Trans i18nKey="library-panels.folder-link.dashboards">Dashboards</Trans>
        </span>
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
    metaContainer: css({
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      paddingTop: theme.spacing(0.5),

      svg: {
        marginRight: theme.spacing(0.5),
        marginBottom: 3,
      },
    }),
  };
}
