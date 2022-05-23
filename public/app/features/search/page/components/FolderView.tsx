import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getBackendSrv } from '@grafana/runtime';
import { Spinner, useStyles2 } from '@grafana/ui';

import { GENERAL_FOLDER_UID } from '../../constants';
import { getGrafanaSearcher } from '../../service';
import { SearchResultsProps } from '../components/SearchResultsTable';

import { DashboardSection, FolderSection } from './FolderSection';

type Props = Pick<SearchResultsProps, 'selection' | 'selectionToggle' | 'onTagSelected'> & {
  tags?: string[];
  hidePseudoFolders?: boolean;
};
export const FolderView = ({ selection, selectionToggle, onTagSelected, tags, hidePseudoFolders }: Props) => {
  const styles = useStyles2(getStyles);

  const results = useAsync(async () => {
    const folders: DashboardSection[] = [];
    if (!hidePseudoFolders) {
      const stars = await getBackendSrv().get('api/user/stars');
      if (stars.length > 0) {
        folders.push({ title: 'Starred', icon: 'star', kind: 'query-star', uid: '__starred', itemsUIDs: stars });
      }
      folders.push({ title: 'Recent', icon: 'clock', kind: 'query-recent', uid: '__recent' });
    }
    folders.push({ title: 'General', url: '/dashboards', kind: 'folder', uid: GENERAL_FOLDER_UID });

    const rsp = await getGrafanaSearcher().search({
      query: '*',
      kind: ['folder'],
    });
    for (const row of rsp.view) {
      folders.push({
        title: row.name,
        url: row.url,
        uid: row.uid,
        kind: row.kind,
      });
    }

    return folders;
  }, []);

  if (results.loading) {
    return <Spinner />;
  }
  if (!results.value) {
    return <div>?</div>;
  }

  return (
    <div className={styles.wrapper}>
      {results.value.map((section) => {
        return (
          <div data-testid={selectors.components.Search} className={styles.section} key={section.title}>
            {section.title && (
              <FolderSection
                selection={selection}
                selectionToggle={selectionToggle}
                onTagSelected={onTagSelected}
                section={section}
                tags={tags}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const { md, sm } = theme.v1.spacing;

  return {
    virtualizedGridItemWrapper: css`
      padding: 4px;
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
      overflow: auto;

      > ul {
        list-style: none;
      }

      border: solid 1px ${theme.v1.colors.border2};
    `,
    section: css`
      display: flex;
      flex-direction: column;
      background: ${theme.v1.colors.panelBg};
      border-bottom: solid 1px ${theme.v1.colors.border2};
    `,
    sectionItems: css`
      margin: 0 24px 0 32px;
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    `,
    gridContainer: css`
      display: grid;
      gap: ${sm};
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      margin-bottom: ${md};
    `,
    resultsContainer: css`
      position: relative;
      flex-grow: 10;
      margin-bottom: ${md};
      background: ${theme.v1.colors.bg1};
      border: 1px solid ${theme.v1.colors.border1};
      border-radius: 3px;
      height: 100%;
    `,
    noResults: css`
      padding: ${md};
      background: ${theme.v1.colors.bg2};
      font-style: italic;
      margin-top: ${theme.v1.spacing.md};
    `,
    listModeWrapper: css`
      position: relative;
      height: 100%;
      padding: ${md};
    `,
  };
};
