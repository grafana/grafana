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
  Link,
} from '@grafana/ui';
import { getAPINamespace } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { GrafanaSearcher, SearchQuery } from '../search/service/types';
import { SearchHit, UnifiedSearcher } from '../search/service/unified';
import { getColumnStyles } from '../search/page/components/SearchResultsTable';
import kbn from 'app/core/utils/kbn';
import { useLocation } from 'react-router-dom-v5-compat';
import { iconItem } from '../canvas/elements/icon';
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

  const location = useLocation();
  const [navModel, setNavModel] = useState(useNavModel('finder'));

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
    const fetchFolderName = async (folderId: string) => {
      const folder = await searcher.fetchResults({ kind: ['folder'], uid: [folderId] });
      return folder.hits[0].title;
    };
    const buildNavModel = async () => {
      if (!location.pathname.endsWith('finder')) {
        // TODO: handle multiple levels of folders
        const parts = location.pathname.split('/');
        const folderId = parts[parts.length - 1];
        const folderName = await fetchFolderName(folderId);
        const navModelWithChildren = {
          ...navModel,
          main: {
            ...navModel.main,
            active: false,
            children: [
              // TODO: first child is ignored for some reason, so add a dummy child
              { text: folderName, icon: 'folder'},
              {
                text: folderName,
                url: '/foo',
                icon: 'folder',
                active: true,
              },
            ],
          },
          node: {
            ...navModel.node,
            active: false,
            children: [
              // TODO: first child is ignored for some reason
              { text: folderName, icon: 'folder' },
              {
                text: folderName,
                url: '/foo',
                icon: 'folder',
                active: true,
              },
            ],
          },
        };
        // @ts-ignore
        setNavModel(navModelWithChildren);
      }
    };
    buildNavModel()
  }, [location.pathname]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const kinds = selectedTypes.map((t) => t.value!.toString());
      let query: SearchQuery = { kind: kinds, tags: selectedTags, query: searchTerm }
      if (!location.pathname.endsWith('finder')) {
        const parts = location.pathname.split('/');
        const folderId = parts[parts.length - 1];
        query = {...query, location: folderId}
      }
      try {
        const results = await Promise.all([
          searcher.fetchResults(query),
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
  }, [selectedTypes, selectedTags, searchTerm, location.pathname]);

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

  // TODO: Implement folder expand/collapse
  // const handleExpand = (folder: Folder) => {
  //   setFolders((prevFolders) =>
  //     prevFolders.map((f) => (f.name === folder.name ? { ...f, isExpanded: !f.isExpanded } : f))
  //   );
  // };

  function toURL(resource: string, name: string, title: string): string {
    if (resource.startsWith('folder')) {
      return `/finder/${name}`;
    }
    if (resource.startsWith('playlist')) {
      return `/playlists/play/${name}`;
    }
    if (resource.startsWith('alert')) {
      return `/alerting/grafana/${name}`;
    }
    if (resource.startsWith('slo')) {
      return `/d/grafana_slo_app-${name}`;
    }
    const slug = kbn.slugifyForUrl(title);
    return `/d/${name}/${slug}`;
  }
  
  const onResourceLinkClicked = () => {}

  const renderTable = (resources: SearchHit[]) => {
    const columns: Array<Column<Resource>> = 
      [
          {
            id: 'name',
            header: 'Name',
            cell: ({ row: { original } }) => (
              <div style={{ marginLeft: original.level ? original.level * 20 : 0 }}>
                <Link
                  aria-label={`open-${original.title}`}
                  href={toURL(original.resource, original.name, original.title)}
                  className="external-link"
                  onClick={onResourceLinkClicked}
                >
                {original.title}
                </Link>
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
  // expandIcon: css({
  //   cursor: 'pointer',
  //   marginRight: theme.spacing(1),
  // }),
});

export default FoldersPage;
