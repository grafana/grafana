import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2, Icon, Pagination, Spinner, LinkButton } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { SparkJoyToggle } from 'app/core/components/SparkJoyToggle';
import { setSparkJoyEnabled } from 'app/core/utils/sparkJoy';

import { listFolders, PAGE_SIZE as API_PAGE_SIZE } from '../api/services';
import { BrowsingSectionTitle } from './BrowsingSectionTitle';
import { HackathonTable, TableColumn } from './HackathonTable';

const DISPLAY_PAGE_SIZE = 12;

export const ViewAllFolders = () => {
  const styles = useStyles2(getStyles);
  const [currentPage, setCurrentPage] = useState(1);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleToggleSparkJoy = () => {
    setSparkJoyEnabled(false);
    window.location.href = '/dashboards';
  };

  useEffect(() => {
    const fetchAllFolders = async () => {
      setIsLoading(true);
      try {
        // Fetch multiple pages to get all folders
        const folders: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
          // Limit to 10 pages (500 folders) for performance
          const result = await listFolders(undefined, undefined, page, API_PAGE_SIZE);
          folders.push(...result);
          
          if (result.length < API_PAGE_SIZE) {
            hasMore = false;
          } else {
            page++;
          }
        }

        setAllFolders(folders);
      } catch (error) {
        console.error('Failed to fetch folders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllFolders();
  }, []);

  const handleFolderClick = (folder: any) => {
    if (folder.url) {
      window.location.href = folder.url;
    }
  };

  const columns: TableColumn[] = [
    {
      key: 'name',
      header: 'Name',
      width: '3fr',
      render: (folder) => (
        <Stack direction="row" gap={1.5} alignItems="center">
          <Icon name="folder" size="lg" style={{ color: '#FFB800' }} />
          <Text weight="medium">{folder.title}</Text>
        </Stack>
      ),
    },
    {
      key: 'location',
      header: 'Parent Folder',
      width: '2fr',
      render: (folder) =>
        folder.parentTitle ? (
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="folder-open" size="sm" />
            <Text variant="bodySmall" color="secondary">
              {folder.parentTitle}
            </Text>
          </Stack>
        ) : (
          <Text variant="bodySmall" color="secondary">
            Root
          </Text>
        ),
    },
  ];

  // Client-side pagination
  const totalItems = allFolders.length;
  const totalPages = Math.ceil(totalItems / DISPLAY_PAGE_SIZE);
  const startIndex = (currentPage - 1) * DISPLAY_PAGE_SIZE;
  const endIndex = startIndex + DISPLAY_PAGE_SIZE;
  const paginatedData = allFolders.slice(startIndex, endIndex);

  return (
    <Page navId="dashboards/browse" actions={
      <LinkButton variant="primary" icon="arrow-left" href="/dashboards">
        Back to Dashboards
      </LinkButton>
    }>
      <AppChromeUpdate
        actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={handleToggleSparkJoy} />]}
      />
      <Page.Contents>
        <div className={styles.container}>
          <BrowsingSectionTitle
            title="All Folders"
            subtitle={`${totalItems} folders in your organization`}
            icon="folder"
          />

          {isLoading && (
            <div className={styles.loadingContainer}>
              <Spinner />
              <Text variant="bodySmall">Loading folders...</Text>
            </div>
          )}

          {!isLoading && (
            <>
              <HackathonTable
                columns={columns}
                data={paginatedData}
                onRowClick={handleFolderClick}
                emptyMessage="No folders found. Start organizing your dashboards with folders."
              />

              {totalPages > 1 && (
                <div className={styles.paginationContainer}>
                  <Pagination
                    numberOfPages={totalPages}
                    currentPage={currentPage}
                    onNavigate={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(3),
  }),

  grid: css({
    marginTop: theme.spacing(3),
  }),

  loadingContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(6),
  }),

  folderCard: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    border: '2px solid transparent',

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
    },

    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(255, 120, 10, 0.12)',

      '&::before': {
        opacity: 0.35,
      },
    },
  }),

  icon: css({
    color: theme.colors.warning.main,
    flexShrink: 0,
  }),

  titleWrapper: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  paginationContainer: css({
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing(4),
  }),

  emptyCard: css({
    padding: theme.spacing(6),
    textAlign: 'center',
  }),

  emptyIcon: css({
    color: theme.colors.text.secondary,
    opacity: 0.5,
  }),
});
