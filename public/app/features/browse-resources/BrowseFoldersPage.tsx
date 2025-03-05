import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import React, { useState, useEffect } from 'react';
import {
  EmptyState,
  LoadingPlaceholder,
  InteractiveTable,
  Column,
  Select,
  Icon,
  Stack,
  useStyles2,
  FilterInput,
} from '@grafana/ui';

import { Page } from 'app/core/components/Page/Page';
import { SearchHit, UnifiedSearcher } from '../search/service/unified';
import { GrafanaSearcher } from '../search/service/types';
import { getAPINamespace } from 'app/api/utils';

interface Folder extends SearchHit {
  isExpanded?: boolean;
  owner?: string;
  level?: number;
  parentId?: number;
  hasSubfolders?: boolean;
}

type ResourceType = 'dashboard' | 'folder' | 'alert' | 'playlist' | 'slo';
type GroupByOption = 'default' | 'type';

const typeOptions: Array<SelectableValue<ResourceType>> = [
  { label: 'All', value: undefined },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Folder', value: 'folder' },
  { label: 'Alert', value: 'alert' },
  { label: 'Playlist', value: 'playlist' },
  { label: 'SLO', value: 'slo' },
];

const groupByOptions: Array<SelectableValue<GroupByOption>> = [
  { label: 'Default', value: 'default' },
  { label: 'Type', value: 'type' },
];

const searchURI = `/apis/search.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/search`;

const searcher = new UnifiedSearcher({} as GrafanaSearcher, searchURI);

const FoldersPage: React.FC = () => {
  const [folders, setFolders] = useState<Array<Folder>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<SelectableValue<ResourceType>>();
  const [selectedTag, setSelectedTag] = useState<SelectableValue<string>>();
  const [selectedOwner, setSelectedOwner] = useState<SelectableValue<string>>();
  const [groupBy, setGroupBy] = useState<SelectableValue<GroupByOption>>(groupByOptions[0]);
  // const [availableTags, setAvailableTags] = useState<Array<SelectableValue<string>>>([]);
  // const [availableOwners, setAvailableOwners] = useState<Array<SelectableValue<string>>>([]);
  
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // TODO: fetch tags
    // fetchTags();
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      
      // const response = await fetch('/api/folders');
      // TODO: fix this - kind doesn't allow more than two values - and "types" doesn't seem to work
      const response = await searcher.fetchResults({ kind: ['folders', 'dashboards'] });

      // TODO: fetch and populate the tags in a separate call - see above
      // const tags = await searcher.tags({ kind: [selected kinds], query: [search input], tags: [selected tags] });
      // Extract unique tags and owners for filters
      // const tags = new Set<string>();
      // const owners = new Set<string>();
      // response.forEach((folder: Folder) => {
      //   folder.tags = folder.tags || [];  // Initialize tags if undefined
      //   folder.tags?.forEach((tag) => tags.add(tag));
      //   if (folder.owner) {
      //     owners.add(folder.owner);
      //   }
      // });

      // setAvailableTags(Array.from(tags).map((tag) => ({ label: tag, value: tag })));
      // setAvailableOwners(Array.from(owners).map((owner) => ({ label: owner, value: owner })));
      setFolders(response.hits);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filterFolders = (folders: Array<SearchHit>) => {
    return folders.filter((folder) => {
      const matchesSearch = folder.title.toLowerCase().includes(searchTerm.toLowerCase());
      // const matchesType = !selectedType?.value || folder.type === selectedType.value;
      const matchesTag = !selectedTag?.value || folder.tags.includes(selectedTag.value);
      // const matchesOwner = !selectedOwner?.value || folder.owner === selectedOwner.value;
      // return matchesSearch && matchesType && matchesTag && matchesOwner;
      return matchesSearch  && matchesTag;
    });
  };

  const groupFolders = (folders: Array<Folder>) => {
    if (groupBy.value === 'type') {
      const groups: Record<string, Array<Folder>> = {};
      typeOptions.forEach((type) => {
        if (type.value) {
          groups[type.value] = folders.filter((f) => f.resource === type.value);
        }
      });
      return groups;
    } else {
      return {
        'My Folders': folders.filter((f) => f.owner === 'currentUser'), // Replace with actual current user check
        'Team Folders': folders.filter((f) => f.owner !== 'currentUser'),
      };
    }
  };

  const handleExpand = (folder: Folder) => {
    setFolders((prevFolders) =>
      prevFolders.map((f) => (f.name === folder.name ? { ...f, isExpanded: !f.isExpanded } : f))
    );
  };

  const renderGroupedTable = (groupName: string, groupFolders: Array<Folder>) => {
    const columns: Array<Column<Folder>> = groupBy.value === 'type' 
      ? [
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
            id: 'owner',
            header: 'Owner',
            cell: ({ row: { original } }) => original.owner,
          },
        ]
      : [
          {
            id: 'name',
            header: 'Name',
            cell: ({ row: { original } }) => (
              <div style={{ marginLeft: original.level ? original.level * 20 : 0 }}>
                {original.hasSubfolders && (
                  <Icon
                    name={original.isExpanded ? 'angle-down' : 'angle-right'}
                    onClick={() => handleExpand(original)}
                    className={styles.expandIcon}
                  />
                )}
                {original.title}
              </div>
            ),
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
          {
            id: 'owner',
            header: 'Owner',
            cell: ({ row: { original } }) => original.owner,
          },
        ];

    return (
      <div className={styles.groupSection} key={groupName}>
        <div className={styles.groupHeader}>
          <h3>{groupName}</h3>
        </div>
        <InteractiveTable
          data={groupFolders}
          columns={columns}
          getRowId={(row) => row.name}
        />
      </div>
    );
  };

  const filteredFolders = filterFolders(folders);
  const groupedFolders = groupFolders(filteredFolders);

  return (
    <Page>
      <Page.Contents>
        <h1>Folders</h1>
        <h4>Search and Browse Folders</h4>
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
            <div className={styles.groupBySelect}>
              <Select
                value={groupBy}
                onChange={setGroupBy}
                options={groupByOptions}
                width={20}
              />
            </div>
          </Stack>
        </div>

        {isLoading && <LoadingPlaceholder text="Loading folders..." />}
        
        {error && (
          <EmptyState message={error} variant={'call-to-action'} />
        )}

        {!isLoading && !error && Object.entries(groupedFolders).map(([groupName, folders]) => 
          renderGroupedTable(groupName, folders)
        )}
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