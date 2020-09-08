import React, { FC, useCallback } from 'react';
import { css, cx } from 'emotion';
import { useLocalStorage } from 'react-use';
import { GrafanaTheme } from '@grafana/data';
import { Icon, Spinner, stylesFactory, useTheme } from '@grafana/ui';
import { DashboardSection, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';
import { getSectionIcon, getSectionStorageKey } from '../utils';

interface SectionHeaderProps {
  editable?: boolean;
  onSectionClick: (section: DashboardSection) => void;
  onToggleChecked?: OnToggleChecked;
  section: DashboardSection;
}

export const SectionHeader: FC<SectionHeaderProps> = ({
  section,
  onSectionClick,
  onToggleChecked,
  editable = false,
}) => {
  const theme = useTheme();
  const styles = getSectionHeaderStyles(theme, section.selected, editable);
  const setSectionExpanded = useLocalStorage(getSectionStorageKey(section.title), true)[1];

  const onSectionExpand = () => {
    setSectionExpanded(!section.expanded);
    onSectionClick(section);
  };

  const onSectionChecked = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleChecked) {
        onToggleChecked(section);
      }
    },
    [section]
  );

  return (
    <div
      className={styles.wrapper}
      onClick={onSectionExpand}
      aria-label={section.expanded ? `Collapse folder ${section.id}` : `Expand folder ${section.id}`}
    >
      <SearchCheckbox editable={editable} checked={section.checked} onClick={onSectionChecked} />

      <div className={styles.icon}>
        <Icon name={getSectionIcon(section)} />
      </div>

      <div className={styles.text}>
        {section.title}
        {section.url && (
          <a href={section.url} className={styles.link}>
            <span className={styles.separator}>|</span> <Icon name="folder-upload" /> Go to folder
          </a>
        )}
      </div>

      {section.itemsFetching ? <Spinner /> : <Icon name={section.expanded ? 'angle-down' : 'angle-right'} />}
    </div>
  );
};

const getSectionHeaderStyles = stylesFactory((theme: GrafanaTheme, selected = false, editable: boolean) => {
  const { sm } = theme.spacing;
  return {
    wrapper: cx(
      css`
        display: flex;
        align-items: center;
        font-size: ${theme.typography.size.base};
        padding: 12px;
        color: ${theme.colors.textWeak};

        &:hover,
        &.selected {
          color: ${theme.colors.text};
        }

        &:hover {
          a {
            opacity: 1;
          }
        }
      `,
      'pointer',
      { selected }
    ),
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
  };
});
