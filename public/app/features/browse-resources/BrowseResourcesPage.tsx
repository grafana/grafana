import { css } from '@emotion/css';
import { t } from 'i18next';
import React, { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';

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
  const [searchQuery, setSearchQuery] = useState('');
  
  const styles = useStyles2(getStyles);

  const navModel = useNavModel('finder');

  const columnStyles = useStyles2(getColumnStyles);

  // Create a debounced function to update searchTerm
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearchTerm(query);
      }, 300),
    []
  );

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

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
      case 'alerts':
        return 'bell';
      case 'slos':
        return 'chart-line';
      default:
        return 'folder';
    }
  };

  const handleExpand = (resource: Resource) => {
    setResources((prevResources) =>
      prevResources.map((r) => (r.name === resource.name ? { ...r, isExpanded: !r.isExpanded } : r))
    );
  };

  const renderTable = (resources: SearchHit[]) => {
    // Get root level resources (location === "general")
    const rootResources = resources.filter(resource => resource.location === "general");
    
    // Create the final data array with expanded children
    const tableData = rootResources.reduce((acc: Resource[], resource: Resource) => {
      acc.push(resource);
      // If this is an expanded folder, add its children
      if (resource.isExpanded && resource.resource === 'folders') {
        const children = resources.filter(r => r.location === resource.title);
        acc.push(...children);
      }
      return acc;
    }, []);

    // Helper to check if a folder has any children
    const hasChildren = (folder: Resource) => {
      return resources.some(r => r.location === folder.title);
    };

    const columns: Array<Column<Resource>> = [
      {
        id: 'expand',
        header: '',
        cell: ({ row: { original } }) => {
          if (original.resource === 'folders' && hasChildren(original)) {
            return (
              <div className={styles.expandCell}>
                <button onClick={() => handleExpand(original)} className={styles.expandButton}>
                  <Icon name={original.isExpanded ? 'angle-down' : 'angle-right'} />
                </button>
              </div>
            );
          }
          return <div className={styles.expandCell} />;
        },
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ row: { original } }) => (
          <div style={{ marginLeft: original.location !== "general" ? 20 : 0 }} className="flex items-center">
            {original.title}
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row: { original } }) => {
          const iconName = getIconForResource(original.resource);
          const displayType = original.resource.slice(0, -1); // Remove last character ('s')
          
          return (
            <div className="flex items-center">
              {iconName && <Icon name={iconName} style={{ marginRight: '6px' }}/>}
              <span className={styles.resourceType}>{displayType}</span>
            </div>
          );
        },
      },
      {
        id: 'location',
        header: 'Location',
        cell: ({ row: { original } }) => {
          return (
            <div className="flex items-center">
              <Icon name={'folder'} style={{ marginRight: '6px' }}/>
              <span>{original.location}</span>
            </div>
          );
        },
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

    return (
        <InteractiveTable
          data={tableData}
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
                value={searchQuery}
                onChange={handleSearchChange}
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
  resourceType: css({
    textTransform: 'capitalize',
  }),
  expandCell: css({
    width: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  expandButton: css({
    background: 'none',
    border: 'none',
    padding: theme.spacing(0, 1),
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});

export default FoldersPage;

