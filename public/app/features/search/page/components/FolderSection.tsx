import { css, cx } from '@emotion/css';
import React, { FC } from 'react';
import { useAsync, useLocalStorage } from 'react-use';

import { GrafanaTheme } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Card, Checkbox, CollapsableSection, Icon, Spinner, stylesFactory, useTheme } from '@grafana/ui';
import impressionSrv from 'app/core/services/impression_srv';
import { getSectionStorageKey } from 'app/features/search/utils';
import { useUniqueId } from 'app/plugins/datasource/influxdb/components/useUniqueId';

import { SearchItem } from '../..';
import { getGrafanaSearcher, SearchQuery } from '../../service';
import { DashboardSearchItemType, DashboardSectionItem } from '../../types';
import { SelectionChecker, SelectionToggle } from '../selection';

export interface DashboardSection {
  kind: string; // folder | query!
  uid: string;
  title: string;
  selected?: boolean; // not used ?  keyboard
  url?: string;
  icon?: string;
  itemsUIDs?: string[]; // for pseudo folders
}

interface SectionHeaderProps {
  selection?: SelectionChecker;
  selectionToggle?: SelectionToggle;
  onTagSelected: (tag: string) => void;
  section: DashboardSection;
  renderStandaloneBody?: boolean; // render the body on its own
  tags?: string[];
}

export const FolderSection: FC<SectionHeaderProps> = ({
  section,
  selectionToggle,
  onTagSelected,
  selection,
  renderStandaloneBody,
  tags,
}) => {
  const editable = selectionToggle != null;
  const theme = useTheme();
  const styles = getSectionHeaderStyles(theme, section.selected, editable);
  const [sectionExpanded, setSectionExpanded] = useLocalStorage(getSectionStorageKey(section.title), false);

  const results = useAsync(async () => {
    if (!sectionExpanded && !renderStandaloneBody) {
      return Promise.resolve([] as DashboardSectionItem[]);
    }
    let folderUid: string | undefined = section.uid;
    let folderTitle: string | undefined = section.title;
    let query: SearchQuery = {
      query: '*',
      kind: ['dashboard'],
      location: section.uid,
      sort: 'name_sort',
    };
    if (section.title === 'Starred') {
      query = {
        uid: section.itemsUIDs, // array of UIDs
      };
      folderUid = undefined;
      folderTitle = undefined;
    } else if (section.title === 'Recent') {
      const ids = impressionSrv.getDashboardOpened();
      const uids = await getBackendSrv().get(`/api/dashboards/ids/${ids.slice(0, 30).join(',')}`);
      if (uids?.length) {
        query = {
          uid: uids,
        };
      }
      folderUid = undefined;
      folderTitle = undefined;
    }
    const raw = await getGrafanaSearcher().search({ ...query, tags });
    const v = raw.view.map(
      (item) =>
        ({
          uid: item.uid,
          title: item.name,
          url: item.url,
          uri: item.url,
          type: item.kind === 'folder' ? DashboardSearchItemType.DashFolder : DashboardSearchItemType.DashDB,
          id: 666, // do not use me!
          isStarred: false,
          tags: item.tags ?? [],
          folderUid,
          folderTitle,
        } as DashboardSectionItem)
    );
    return v;
  }, [sectionExpanded, section, tags]);

  const onSectionExpand = () => {
    setSectionExpanded(!sectionExpanded);
  };

  const onToggleFolder = (evt: React.FormEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (selectionToggle && selection) {
      const checked = !selection(section.kind, section.uid);
      selectionToggle(section.kind, section.uid);
      const sub = results.value ?? [];
      for (const item of sub) {
        if (selection('dashboard', item.uid!) !== checked) {
          selectionToggle('dashboard', item.uid!);
        }
      }
    }
  };

  const onToggleChecked = (item: DashboardSectionItem) => {
    if (selectionToggle) {
      selectionToggle('dashboard', item.uid!);
    }
  };

  const id = useUniqueId();
  const labelId = `section-header-label-${id}`;

  let icon = section.icon;
  if (!icon) {
    icon = sectionExpanded ? 'folder-open' : 'folder';
  }

  const renderResults = () => {
    if (!results.value?.length) {
      if (results.loading) {
        return <Spinner />;
      }

      return (
        <Card>
          <Card.Heading>No results found</Card.Heading>
        </Card>
      );
    }

    return results.value.map((v) => {
      if (selection && selectionToggle) {
        const type = v.type === DashboardSearchItemType.DashFolder ? 'folder' : 'dashboard';
        v = {
          ...v,
          checked: selection(type, v.uid!),
        };
      }
      return (
        <SearchItem
          key={v.uid}
          item={v}
          onTagSelected={onTagSelected}
          onToggleChecked={onToggleChecked as any}
          editable={Boolean(selection != null)}
        />
      );
    });
  };

  // Skip the folder wrapper
  if (renderStandaloneBody) {
    return <div>{renderResults()}</div>;
  }

  return (
    <CollapsableSection
      isOpen={sectionExpanded ?? false}
      onToggle={onSectionExpand}
      className={styles.wrapper}
      contentClassName={styles.content}
      loading={results.loading}
      labelId={labelId}
      label={
        <>
          {selectionToggle && selection && (
            <div className={styles.checkbox} onClick={onToggleFolder}>
              <Checkbox value={selection(section.kind, section.uid)} aria-label="Select folder" />
            </div>
          )}

          <div className={styles.icon}>
            <Icon name={icon as any} />
          </div>

          <div className={styles.text}>
            <span id={labelId}>{section.title}</span>
            {section.url && section.uid !== 'general' && (
              <a href={section.url} className={styles.link}>
                <span className={styles.separator}>|</span> <Icon name="folder-upload" /> Go to folder
              </a>
            )}
          </div>
        </>
      }
    >
      {results.value && <ul className={styles.sectionItems}>{renderResults()}</ul>}
    </CollapsableSection>
  );
};

const getSectionHeaderStyles = stylesFactory((theme: GrafanaTheme, selected = false, editable: boolean) => {
  const { sm } = theme.spacing;
  return {
    wrapper: cx(
      css`
        align-items: center;
        font-size: ${theme.typography.size.base};
        padding: 12px;
        border-bottom: none;
        color: ${theme.colors.textWeak};
        z-index: 1;

        &:hover,
        &.selected {
          color: ${theme.colors.text};
        }

        &:hover,
        &:focus-visible,
        &:focus-within {
          a {
            opacity: 1;
          }
        }
      `,
      'pointer',
      { selected }
    ),
    sectionItems: css`
      margin: 0 24px 0 32px;
    `,
    checkbox: css`
      padding: 0 ${sm} 0 0;
    `,
    icon: css`
      padding: 0 ${sm} 0 ${editable ? 0 : sm};
    `,
    text: css`
      flex-grow: 1;
      line-height: 24px;
    `,
    link: css`
      padding: 2px 10px 0;
      color: ${theme.colors.textWeak};
      opacity: 0;
      transition: opacity 150ms ease-in-out;
    `,
    separator: css`
      margin-right: 6px;
    `,
    content: css`
      padding-top: 0px;
      padding-bottom: 0px;
    `,
  };
});
