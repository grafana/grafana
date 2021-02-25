import { Icon, Input, Button, stylesFactory, useStyles } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { cx, css } from 'emotion';
import { LibraryPanelCard } from '../LibraryPanelCard/LibraryPanelCard';
import { DateTimeInput, GrafanaTheme } from '@grafana/data';
import { deleteLibraryPanel, getLibraryPanels, LibraryPanelDTO } from '../../state/api';

interface LibraryPanelViewProps {
  className?: string;
  onCreateNewPanel?: () => void;
  children?: (panel: LibraryPanelDTO, i: number) => JSX.Element | JSX.Element[];
  onClickCard?: (panel: LibraryPanelDTO) => void;
  formatDate?: (dateString: DateTimeInput, format?: string) => string;
  showSecondaryActions?: boolean;
  currentPanelId?: string;
}

export const LibraryPanelsView: React.FC<LibraryPanelViewProps> = ({
  children,
  className,
  onCreateNewPanel,
  onClickCard,
  formatDate,
  showSecondaryActions,
  currentPanelId: currentPanel,
}) => {
  const styles = useStyles(getPanelViewStyles);
  const [searchString, setSearchString] = useState('');

  // Deliberately not using useAsync here as we want to be able to update libraryPanels without
  // making an additional API request (for example when a user deletes a library panel and we want to update the view to reflect that)
  const [libraryPanels, setLibraryPanels] = useState<LibraryPanelDTO[] | undefined>(undefined);
  useEffect(() => {
    getLibraryPanels().then((panels) => {
      setLibraryPanels(panels);
    });
  }, []);

  const [filteredItems, setFilteredItems] = useState(libraryPanels);
  useDebounce(
    () => {
      setFilteredItems(
        libraryPanels?.filter(
          (v) => v.name.toLowerCase().includes(searchString.toLowerCase()) && v.uid !== currentPanel
        )
      );
    },
    300,
    [searchString, libraryPanels, currentPanel]
  );

  const onDeletePanel = async (uid: string) => {
    try {
      await deleteLibraryPanel(uid);
      const panelIndex = libraryPanels!.findIndex((panel) => panel.uid === uid);
      setLibraryPanels([...libraryPanels!.slice(0, panelIndex), ...libraryPanels!.slice(panelIndex + 1)]);
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className={cx(styles.container, className)}>
      <div className={styles.searchHeader}>
        <Input
          placeholder="Search the panel library"
          prefix={<Icon name="search" />}
          value={searchString}
          autoFocus
          onChange={(e) => setSearchString(e.currentTarget.value)}
        ></Input>
        {/* <Select placeholder="Filter by" onChange={() => {}} width={35} /> */}
      </div>
      <div className={styles.libraryPanelList}>
        {libraryPanels === undefined ? (
          <p>Loading library panels...</p>
        ) : filteredItems?.length! < 1 ? (
          <p>No library panels found.</p>
        ) : (
          filteredItems?.map((item, i) => (
            <LibraryPanelCard
              key={`shared-panel=${i}`}
              libraryPanel={item}
              onDelete={() => onDeletePanel(item.uid)}
              onClick={onClickCard}
              formatDate={formatDate}
              showSecondaryActions={showSecondaryActions}
            >
              {children?.(item, i)}
            </LibraryPanelCard>
          ))
        )}
      </div>
      {onCreateNewPanel && (
        <Button icon="plus" className={styles.newPanelButton} onClick={onCreateNewPanel}>
          Create a new reusable panel
        </Button>
      )}
    </div>
  );
};

const getPanelViewStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: ${theme.spacing.sm};
      height: 100%;
    `,
    libraryPanelList: css`
      display: flex;
      overflow-x: auto;
      flex-direction: column;
    `,
    searchHeader: css`
      display: flex;
    `,
    newPanelButton: css`
      margin-top: 10px;
      align-self: flex-start;
    `,
  };
});
