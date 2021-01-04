import { Icon, Input, Select, Button, useTheme, stylesFactory } from '@grafana/ui';
import React, { useState } from 'react';
import { useAsync, useDebounce } from 'react-use';
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
  const libraryPanelState = useAsync(async (): Promise<LibraryPanelCardProps[]> => {
    const [libraryPanels, users] = await Promise.all([
      getBackendSrv().getLibraryPanels(),
      getBackendSrv().getOrgUsers(),
    ]);

    return libraryPanels.map((libraryPanel) => {
      const lastAuthor = users.find((user) => user.userId === libraryPanel.UpdatedBy);

      return {
        id: libraryPanel.ID,
        uid: libraryPanel.UID,
        title: libraryPanel.Name,
        usageCount: 48,
        varCount: 3,
        lastEdited: libraryPanel.Updated,
        lastAuthor: lastAuthor?.login,
        avatarUrl: lastAuthor?.avatarUrl,
        model: libraryPanel.Model,
      };
    });
  }, []);

  const [filteredItems, setFilteredItems] = useState(libraryPanelState.value);
  useDebounce(
    () => {
      setFilteredItems(libraryPanelState.value?.filter((v) => v.title.toLowerCase().includes(searchString)));
    },
    300,
    [searchString, libraryPanelState.value]
  );

  const onDeletePanel = (uid: string) => {
    getBackendSrv().deleteLibraryPanel(uid);
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
        {libraryPanelState.loading ? (
          <p>Loading library panels...</p>
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
