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
import { useNavModel } from 'app/core/hooks/useNavModel';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';
import { t } from 'i18next';

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
  const [selectedTypes, setSelectedTypes] = useState<Array<SelectableValue<ResourceType>>>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<TermCount[]>([]);
  
  const styles = useStyles2(getStyles);

  const navModel = useNavModel('finder');

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
            id: 'type',
            header: 'Type',
            cell: ({ row: { original } }) => original.resource,
          },
          {
            id: 'location',
            header: 'Location',
            cell: ({ row: { original } }) => original.location || '-',
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
