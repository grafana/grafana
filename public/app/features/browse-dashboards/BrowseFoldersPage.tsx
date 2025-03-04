import { css } from '@emotion/css';
import { memo, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

const BrowseFoldersPage = memo(() => {
  const styles = useStyles2(getStyles);

  // useEffect(() => {
  //   stateManager.initStateFromUrl(folderUID);
  //   dispatch(
  //     setAllSelection({
  //       isSelected: false,
  //       folderUID: undefined,
  //     })
  //   );
  // }, [dispatch, folderUID, stateManager]);

  // const { data: folderDTO } = useGetFolderQuery(folderUID ?? skipToken);

  // const onEditTitle = async (newValue: string) => {
  //   if (folderDTO) {
  //     const result = await saveFolder({
  //       ...folderDTO,
  //       title: newValue,
  //     });
  //     if ('error' in result) {
  //       throw result.error;
  //     }
  //   }
  // };

  return (
    <Page
      navId="folders/browse"
      // onEditTitle={onEditTitle}
      // actions={
      //   <>
      //     {folderDTO && <FolderActionsButton folder={folderDTO} />}
      //     (
      //       <CreateNewButton 
      //         parentFolder={folderDTO} 
      //         canCreateFolder={true}
      //         canCreateDashboard={false}
      //       />
      //     )
      //   </>
      // }
    >
      <Page.Contents className={styles.pageContents}>
        <div>
          HELLO FOLDERS
          {/* <FilterInput
            placeholder={getSearchPlaceholder(searchState.includePanels)}
            value={searchState.query}
            escapeRegex={false}
            onChange={(e) => stateManager.onQueryChange(e)}
          /> */}
        </div>

        {/* {hasSelection ? (
          <BrowseActions />
        ) : (
          <div className={styles.filters}>
            <BrowseFilters />
          </div>
        )} */}

        {/* <div className={styles.subView}>
          <AutoSizer>
            {({ width, height }) => (
              <BrowseView
                canSelect={true}
                width={width}
                height={height}
                folderUID={folderUID}
              />
            )}
          </AutoSizer>
        </div> */}
      </Page.Contents>
    </Page>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
  }),

  subView: css({
    height: '100%',
  }),

  filters: css({
    display: 'none',
    [theme.breakpoints.up('md')]: {
      display: 'block',
    },
  }),
});

export default BrowseFoldersPage;
