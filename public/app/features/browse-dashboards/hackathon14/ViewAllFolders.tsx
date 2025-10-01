import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Pagination, Spinner, LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { listFolders, PAGE_SIZE as API_PAGE_SIZE } from '../api/services';
import { BrowsingSectionTitle } from './BrowsingSectionTitle';

const DISPLAY_PAGE_SIZE = 12;

export const ViewAllFolders = () => {
  const styles = useStyles2(getStyles);
  const [currentPage, setCurrentPage] = useState(1);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

          {!isLoading && paginatedData.length > 0 && (
            <>
              <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} className={styles.grid}>
                {paginatedData.map((folder) => (
                  <Card
                    key={folder.uid}
                    className={styles.folderCard}
                    onClick={() => handleFolderClick(folder)}
                  >
                    <Stack direction="column" gap={2}>
                      <Stack direction="row" gap={2} alignItems="flex-start">
                        <Icon name="folder" size="lg" className={styles.icon} />
                        <div className={styles.titleWrapper}>
                          <Text weight="medium">{folder.title}</Text>
                        </div>
                      </Stack>
                      {folder.parentTitle && (
                        <Stack direction="row" gap={1} alignItems="center">
                          <Icon name="folder-open" size="sm" />
                          <Text variant="bodySmall" color="secondary">
                            in {folder.parentTitle}
                          </Text>
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                ))}
              </Grid>

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

          {!isLoading && paginatedData.length === 0 && (
            <Card className={styles.emptyCard}>
              <Stack direction="column" gap={2} alignItems="center">
                <Icon name="folder" size="xxl" className={styles.emptyIcon} />
                <Text variant="h5">No folders found</Text>
                <Text color="secondary">Start organizing your dashboards with folders</Text>
              </Stack>
            </Card>
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
