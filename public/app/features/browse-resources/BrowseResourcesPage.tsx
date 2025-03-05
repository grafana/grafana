import { css } from '@emotion/css';
import { t } from 'i18next';
import React, { useState, useEffect } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
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
  TagList,
} from '@grafana/ui';
import { getAPINamespace } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { GrafanaSearcher } from '../search/service/types';
import { SearchHit, UnifiedSearcher } from '../search/service/unified';
import { getColumnStyles } from '../search/page/components/SearchResultsTable';

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
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Array<SelectableValue<ResourceType>>>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<TermCount[]>([]);
  
  const styles = useStyles2(getStyles);

  const navModel = useNavModel('finder');

  const columnStyles = useStyles2(getColumnStyles);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const kinds = selectedTypes.map((t) => t.value!.toString());
      try {
        const results = await Promise.all([
          searcher.fetchResults({ kind: kinds, tags: selectedTags, query: searchTerm }),
          searcher.tags({ kind: kinds })
        ]);
        setResources(results[0].hits);
        setAvailableTags(results[1]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [selectedTypes, selectedTags, searchTerm]);

  const getIconForResource = (resource: string) => {
    switch (resource) {
      case 'playlists':
        return 'play';
      case 'dashboards':
        return 'apps';
      case 'folders':
          return 'folder';  
      default:
        return 'folder';
    }
  };

  // TODO: Implement folder expand/collapse
  // const handleExpand = (folder: Folder) => {
  //   setFolders((prevFolders) =>
  //     prevFolders.map((f) => (f.name === folder.name ? { ...f, isExpanded: !f.isExpanded } : f))
  //   );
  // };

  const renderTable = (resources: SearchHit[]) => {
    // makeTagsColumn(response, access.tags, availableWidth, styles, onTagSelected))

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
            id: 'type',
            header: 'Type',
            cell: ({ row: { original } }) => {
              // Adds an icon to the left of each resource type
              const iconName = getIconForResource(original.resource);
              
              return (
                <div className="flex items-center">
                  {iconName && <Icon name={iconName} style={{ marginRight: '6px' }}/>}
                  {original.resource}
                </div>
              );
            },
          },
          {
            id: 'location',
            header: 'Location',
            cell: ({ row: { original } }) => original.location || '-',
          },
          {
            id: 'tags',
            header: 'Tags',
            cell: ({ row: { original } }) => (
              <div key={original.name} {...original} className={columnStyles.cell}>
                  {original.tags ? <TagList className={columnStyles.tagList} tags={original.tags} 
                    onClick={
                      (tag) => setSelectedTags([...selectedTags, tag])
                    } /> : '-'
                  }
              </div>
            )
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

  return (
    <Page
      navId="finder"
      navModel={navModel}
    >
      <Page.Contents>
        <div className={styles.filtersRow}>
          <Stack direction="row" gap={2}>
            <FilterInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search resources"
              />
          </Stack>
          <Stack direction="row" gap={2}>
            <Select
              value={selectedTypes}
              onChange={(v) => setSelectedTypes(v as Array<SelectableValue<ResourceType>>)}
              options={typeOptions}
              placeholder="Filter by Type"
              width={20}
              isMulti={true}
            />
            <TagFilter
              isClearable
              tags={selectedTags}
              tagOptions={() => Promise.resolve(availableTags)}
              onChange={setSelectedTags}
              placeholder={t('playlist-edit.form.add-tag-placeholder', 'Filter by Tags')}
              width={20}
            />
          </Stack>
        </div>

        {isLoading && <LoadingPlaceholder text="Loading folders..." />}
        
        {error && (
          <EmptyState message={error} variant={'call-to-action'} />
        )}

        {!isLoading && !error && renderTable(resources)}
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filtersRow: css({
    display: 'flex',
    flexDirection: 'column',
    gap: `6px`
  }),
  // expandIcon: css({
  //   cursor: 'pointer',
  //   marginRight: theme.spacing(1),
  // }),
});

export default FoldersPage;

