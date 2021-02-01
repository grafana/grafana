import { Icon, Input, Select, Button, useTheme, stylesFactory } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { cx, css } from 'emotion';
import { LibraryPanelCard, LibraryPanelCardProps } from '../LibraryPanelCard/LibraryPanelCard';
import { GrafanaTheme } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';

interface LibraryPanelViewProps {
  className?: string;
  onCreateNewPanel?: () => void;
  children: (panel: LibraryPanelCardProps, i: number) => React.ReactNode;
  formatDate?: (dateString: string) => string;
}

export const LibraryPanelsView: React.FC<LibraryPanelViewProps> = ({
  children,
  className,
  onCreateNewPanel,
  formatDate,
}) => {
  const theme = useTheme();
  const styles = getPanelViewStyles(theme);
  const [searchString, setSearchValue] = useState('');
  // const [modalOpen, setModalOpen] = useState(false);

  // Deliberately not using useAsync here as we want to be able to update libraryPanels without
  // making an additional API request (for example when a user deletes a library panel and we want to update the view to reflect that)
  const [libraryPanels, setLibraryPanels] = useState<LibraryPanelCardProps[] | undefined>(undefined);
  useEffect(() => {
    const libPanelsPromise = getBackendSrv()
      .getLibraryPanels()
      .then((panels) => {
        return Promise.all(
          panels.map((panel) =>
            getBackendSrv()
              .getLibraryPanelConnectedDashboards(panel.uid)
              .then((connected) => {
                return {
                  ...panel,
                  ConnectedDashboards: connected,
                };
              })
          )
        );
      });

    libPanelsPromise.then((panels) => {
      setLibraryPanels(
        panels.map((libraryPanel) => {
          return {
            id: libraryPanel.id,
            uid: libraryPanel.uid,
            title: libraryPanel.name,
            connectedDashboards: libraryPanel.ConnectedDashboards,
            varCount: 3,
            lastEdited: libraryPanel.meta.updated,
            lastAuthor: libraryPanel.meta.updatedBy.name,
            avatarUrl: libraryPanel.meta.updatedBy.avatarUrl,
            model: libraryPanel.model,
          };
        })
      );
    });
  }, []);

  const [filteredItems, setFilteredItems] = useState(libraryPanels);
  useDebounce(
    () => {
      setFilteredItems(libraryPanels?.filter((v) => v.title.toLowerCase().includes(searchString)));
    },
    300,
    [searchString, libraryPanels]
  );

  const onDeletePanel = async (uid: string) => {
    try {
      await getBackendSrv().deleteLibraryPanel(uid);
      const panelIndex = libraryPanels!.findIndex((panel) => panel.uid === uid);
      setLibraryPanels([...libraryPanels!.slice(0, panelIndex), ...libraryPanels!.slice(panelIndex + 1)]);
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className={cx(styles.container, className)}>
      <div className={cx(styles.searchHeader)}>
        <Input
          className={cx(styles.searchInput)}
          placeholder="Search the panel library"
          prefix={<Icon name="search" />}
          value={searchString}
          onChange={(e) => setSearchValue(e.currentTarget.value.toLowerCase())}
        ></Input>
        <Select placeholder="Filter by" onChange={() => {}} width={35} />
      </div>
      <div className={cx(styles.panelTitle)}>Popular panels from the panel library</div>
      <div className={cx(styles.libraryPanelList)}>
        {libraryPanels === undefined ? (
          <p>Loading library panels...</p>
        ) : filteredItems?.length! < 1 ? (
          <p>No library panels found.</p>
        ) : (
          filteredItems?.map((item, i) => (
            <LibraryPanelCard
              {...item}
              key={`shared-panel=${i}`}
              // onClick={() => setModalOpen(true)}
              onDelete={() => onDeletePanel(item.uid)}
              lastEdited={formatDate?.(item.lastEdited ?? '') ?? item.lastEdited}
            >
              {children(item, i)}
            </LibraryPanelCard>
          ))
        )}
      </div>
      {onCreateNewPanel && (
        <Button icon="plus" className={cx(styles.newPanelButton)} onClick={onCreateNewPanel}>
          Create a new reusable panel
        </Button>
      )}
      {/* {modalOpen && (
        <VarImportModal
          vars={[
            { name: 'jobs', definition: 'label_values(job)' },
            { name: 'disk_series', definition: 'metrics(node_disk)' },
            { name: 'query', definition: 'query_result(up{job=~"$jobs"})' },
          ]}
          isOpen={modalOpen}
          onDismiss={() => setModalOpen(false)}
        />
      )} */}
    </div>
  );
};

const getPanelViewStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      height: 100%;
    `,
    libraryPanelList: css`
      display: flex;
      gap: 8px;
      overflow-x: auto;
      flex-direction: column;
    `,
    searchHeader: css`
      display: flex;
    `,
    searchInput: css`
      margin-right: 122px;
    `,
    panelTitle: css`
      line-height: 30px;
    `,
    newPanelButton: css`
      margin-top: 10px;
      align-self: flex-start;
    `,
  };
});
