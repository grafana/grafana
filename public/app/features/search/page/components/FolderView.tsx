import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Spinner, useStyles2 } from '@grafana/ui';

import { getGrafanaSearcher } from '../../service';
import { SearchResultsProps } from '../components/SearchResultsTable';

import { DashboardSection, FolderSection } from './FolderSection';

export const FolderView = ({
  selection,
  selectionToggle,
  onTagSelected,
}: Pick<SearchResultsProps, 'selection' | 'selectionToggle' | 'onTagSelected'>) => {
  const styles = useStyles2(getStyles);

  const results = useAsync(async () => {
    const rsp = await getGrafanaSearcher().search({
      query: '*',
      kind: ['folder'],
    });
    const folders: DashboardSection[] = [
      { title: 'Recent', icon: 'clock', kind: 'query-recent', uid: '__recent' },
      { title: 'Starred', icon: 'star', kind: 'query-star', uid: '__starred' },
      { title: 'General', url: '/dashboards', kind: 'folder', uid: 'general' }, // not sure why this is not in the index
    ];
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

      > ul {
        list-style: none;
      }
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
