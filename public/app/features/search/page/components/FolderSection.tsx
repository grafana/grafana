import { css, cx } from '@emotion/css';
import React, { FC } from 'react';
import { useAsync, useLocalStorage } from 'react-use';

import { GrafanaTheme } from '@grafana/data';
import { Checkbox, CollapsableSection, Icon, stylesFactory, useTheme } from '@grafana/ui';
import { getSectionStorageKey } from 'app/features/search/utils';
import { useUniqueId } from 'app/plugins/datasource/influxdb/components/useUniqueId';

import { SearchItem } from '../..';
import { getGrafanaSearcher } from '../../service';
import { DashboardSearchItemType, DashboardSectionItem } from '../../types';
import { SelectionChecker, SelectionToggle } from '../selection';

export interface DashboardSection {
  kind: string; // folder | query!
  uid: string;
  title: string;
  selected?: boolean; // not used ?  keyboard
  url?: string;
  icon?: string;
}

interface SectionHeaderProps {
  selection?: SelectionChecker;
  selectionToggle?: SelectionToggle;
  onTagSelected: (tag: string) => void;
  section: DashboardSection;
}

export const FolderSection: FC<SectionHeaderProps> = ({ section, selectionToggle, onTagSelected, selection }) => {
  const editable = selectionToggle != null;
  const theme = useTheme();
  const styles = getSectionHeaderStyles(theme, section.selected, editable);
  const [sectionExpanded, setSectionExpanded] = useLocalStorage(getSectionStorageKey(section.title), false);

  const results = useAsync(async () => {
    if (!sectionExpanded) {
      return Promise.resolve([] as DashboardSectionItem[]);
    }
    let query = {
      query: '*',
      kind: ['dashboard'],
      location: section.uid,
    };
    if (section.title === 'Starred') {
      // TODO
    } else if (section.title === 'Recent') {
      // TODO
    }
    const raw = await getGrafanaSearcher().search(query);
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
          checked: selection ? selection(item.kind, item.uid) : false,
        } as DashboardSectionItem)
    );
    console.log('HERE!');
    return v;
  }, [sectionExpanded, section]);

  const onSectionExpand = () => {
    setSectionExpanded(!sectionExpanded);
    console.log('TODO!! section', section.title, section);
  };

  const id = useUniqueId();
  const labelId = `section-header-label-${id}`;

  let icon = section.icon;
  if (!icon) {
    icon = sectionExpanded ? 'folder-open' : 'folder';
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
            <div onClick={(v) => console.log(v)} className={styles.checkbox}>
              <Checkbox value={selection(section.kind, section.uid)} aria-label="Select folder" />
            </div>
          )}

          <div className={styles.icon}>
            <Icon name={icon as any} />
          </div>

          <div className={styles.text}>
            <span id={labelId}>{section.title}</span>
            {section.url && (
              <a href={section.url} className={styles.link}>
                <span className={styles.separator}>|</span> <Icon name="folder-upload" /> Go to folder
              </a>
            )}
          </div>
        </>
      }
    >
      {results.value && (
        <ul>
          {results.value.map((v) => (
            <SearchItem key={v.uid} item={v} onTagSelected={onTagSelected} />
          ))}
        </ul>
      )}
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
