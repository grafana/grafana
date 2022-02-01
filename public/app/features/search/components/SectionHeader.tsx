import React, { FC, useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { useLocalStorage } from 'react-use';
import { GrafanaTheme } from '@grafana/data';
import { CollapsableSection, Icon, stylesFactory, useTheme } from '@grafana/ui';

import { DashboardSection, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';
import { getSectionIcon, getSectionStorageKey } from '../utils';
import { useUniqueId } from 'app/plugins/datasource/influxdb/components/useUniqueId';

interface SectionHeaderProps {
  editable?: boolean;
  onSectionClick: (section: DashboardSection) => void;
  onToggleChecked?: OnToggleChecked;
  section: DashboardSection;
  children: React.ReactNode;
}

export const SectionHeader: FC<SectionHeaderProps> = ({
  section,
  onSectionClick,
  children,
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

  const handleCheckboxClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();

      onToggleChecked?.(section);
    },
    [onToggleChecked, section]
  );

  const id = useUniqueId();
  const labelId = `section-header-label-${id}`;

  return (
    <CollapsableSection
      isOpen={section.expanded ?? false}
      onToggle={onSectionExpand}
      className={styles.wrapper}
      contentClassName={styles.content}
      loading={section.itemsFetching}
      labelId={labelId}
      label={
        <>
          <SearchCheckbox
            className={styles.checkbox}
            editable={editable}
            checked={section.checked}
            onClick={handleCheckboxClick}
            aria-label="Select folder"
          />

          <div className={styles.icon}>
            <Icon name={getSectionIcon(section)} />
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
      {children}
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
