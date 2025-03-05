import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import React, { useState, useEffect } from 'react';
import {
  EmptyState,
  LoadingPlaceholder,
  InteractiveTable,
  Column,
  Select,
  // Icon,
  Stack,
  useStyles2,
  FilterInput,
} from '@grafana/ui';

import { Page } from 'app/core/components/Page/Page';
import { SearchHit, UnifiedSearcher } from '../search/service/unified';
import { GrafanaSearcher } from '../search/service/types';
import { getAPINamespace } from 'app/api/utils';

interface Resource extends SearchHit {
  isExpanded?: boolean;
  owner?: string;
  level?: number;
  parentId?: number;
  hasSubfolders?: boolean;
}

type ResourceType = 'dashboard' | 'folder' | 'alert' | 'playlist' | 'slo';

const typeOptions: Array<SelectableValue<ResourceType>> = [
  { label: 'All', value: undefined },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Folder', value: 'folder' },
  { label: 'Alert', value: 'alert' },
  { label: 'Playlist', value: 'playlist' },
  { label: 'SLO', value: 'slo' },
];

const searchURI = `/apis/search.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/search`;

const searcher = new UnifiedSearcher({} as GrafanaSearcher, searchURI);

const FoldersPage: React.FC = () => {
  const [resources, setResources] = useState<Array<Resource>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<SelectableValue<ResourceType>>();
  const [selectedTag, setSelectedTag] = useState<SelectableValue<string>>();
  const [selectedOwner, setSelectedOwner] = useState<SelectableValue<string>>();

  // const [availableTags, setAvailableTags] = useState<Array<SelectableValue<string>>>([]);
  // const [availableOwners, setAvailableOwners] = useState<Array<SelectableValue<string>>>([]);
  
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const kinds = ['folders', 'dashboards'];
    const loadData = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all([
          searcher.fetchResults({ kind: kinds}),
          searcher.tags({ kind: kinds })
        ]);
        console.log(results);  // TODO: remove
        setResources(results[0].hits);
        // TODO: fix me
        // setTags(results[0]); // Only pass the folder/dashboard results to setTags
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, []);

  const filterResources = (resources: SearchHit[]) => {
    // TODO: Implement filtering
    return resources;
  };

  // TODO: Implement folder expand/collapse
  // const handleExpand = (folder: Folder) => {
  //   setFolders((prevFolders) =>
  //     prevFolders.map((f) => (f.name === folder.name ? { ...f, isExpanded: !f.isExpanded } : f))
  //   );
  // };

  const renderTable = (resources: SearchHit[]) => {
    const columns: Array<Column<Resource>> = 
      [
          {
            id: 'name',
            header: 'Name',
            cell: ({ row: { original } }) => (
              <div style={{ marginLeft: original.level ? original.level * 20 : 0 }}>
                {original.title}
              </div>
            ),
          },
          {
            id: 'location',
            header: 'Location',
            cell: ({ row: { original } }) => original.location || '-',
          },
          {
            id: 'type',
            header: 'Type',
            cell: ({ row: { original } }) => original.resource,
          },
          {
            id: 'tags',
            header: 'Tags',
            cell: ({ row: { original } }) => original.tags?.join(', ') || '-',
          },
        ];
        // TODO if we want to drill down into the folders
       
          // {
          //   id: 'name',
          //   header: 'Name',
          //   cell: ({ row: { original } }) => (
          //     <div style={{ marginLeft: original.level ? original.level * 20 : 0 }}>
          //       {original.hasSubfolders && (
          //         <Icon
          //           name={original.isExpanded ? 'angle-down' : 'angle-right'}
          //           onClick={() => handleExpand(original)}
          //           className={styles.expandIcon}
          //         />
          //       )}
          //       {original.title}
          //     </div>
          //   ),
          // }

    return (
        <InteractiveTable
          data={resources}
          columns={columns}
          getRowId={(row) => row.name}
        />
    );
  };

  const filteredResources = filterResources(resources);

  return (
    <Page>
      <Page.Contents>
        <h1>Finder</h1>
        <h4>Search and Browse Resources</h4>
        <div className={styles.filtersRow}>
          <Stack direction="row" gap={2}>
            <FilterInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search folders"
              width={30}
            />
            <Select
              value={selectedType}
              onChange={setSelectedType}
              options={typeOptions}
              placeholder="Filter by Type"
              width={20}
            />
            <Select
              value={selectedTag}
              onChange={setSelectedTag}
              // options={availableTags}  // TODO
              opotions={[]}
              placeholder="Filter by Tag"
              width={20}
            />
            <Select
              value={selectedOwner}
              onChange={setSelectedOwner}
              options={[]}
              // options={availableOwners} // TODO - maybe
              placeholder="Filter by Owner"
              width={20}
            />
          </Stack>
        </div>

        {isLoading && <LoadingPlaceholder text="Loading folders..." />}
        
        {error && (
          <EmptyState message={error} variant={'call-to-action'} />
        )}

        {!isLoading && !error && renderTable(filteredResources)}
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filtersRow: css({
    marginBottom: theme.spacing(2),
  }),
  groupBySelect: css({
    marginLeft: 'auto',
  }),
  groupSection: css({
    marginBottom: theme.spacing(3),
  }),
  groupHeader: css({
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.borderRadius(1),
    marginBottom: theme.spacing(1),
  }),
  expandIcon: css({
    cursor: 'pointer',
    marginRight: theme.spacing(1),
  }),
});

export default FoldersPage;
