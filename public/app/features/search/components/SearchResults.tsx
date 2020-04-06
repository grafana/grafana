import React, { FC, Dispatch } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { IconType } from '@grafana/ui/src/components/Icon/types';
import { DashboardSection, ItemClickWithEvent, SearchAction } from '../types';
import { SearchItem } from './SearchItem';
import { SearchCheckbox } from './SearchCheckbox';
import PageLoader from '../../../core/components/PageLoader/PageLoader';

export interface Props {
  dispatch?: Dispatch<SearchAction>;
  editable?: boolean;
  loading?: boolean;
  onFolderExpanding?: () => void;
  onSelectionChanged?: () => void;
  onTagSelected: (name: string) => any;
  onToggleSection?: any;
  onToggleSelection?: ItemClickWithEvent;
  results: DashboardSection[] | undefined;
}

export const SearchResults: FC<Props> = ({
  editable,
  loading,
  onFolderExpanding,
  onSelectionChanged,
  onTagSelected,
  onToggleSection,
  onToggleSelection,
  results,
}) => {
  const theme = useTheme();
  const styles = getSectionStyles(theme);

  const toggleFolderExpand = (section: DashboardSection) => {
    if (onToggleSection) {
      onToggleSection(section);
    } else {
      if (section.toggle) {
        if (!section.expanded && onFolderExpanding) {
          onFolderExpanding();
        }

        section.toggle(section).then(() => {
          if (onSelectionChanged) {
            onSelectionChanged();
          }
        });
      }
    }
  };

  if (loading) {
    return <PageLoader />;
  } else if (!results || !results.length) {
    return <h6>No dashboards matching your query were found.</h6>;
  }

  return (
    <ul className={styles.wrapper}>
      {results.map(section => (
        <li aria-label="Search section" className={styles.section} key={section.title}>
          <SectionHeader onSectionClick={toggleFolderExpand} {...{ onToggleSelection, editable, section }} />
          <ul aria-label="Search items" className={styles.wrapper}>
            {section.expanded &&
              section.items.map(item => (
                <SearchItem key={item.id} {...{ item, editable, onToggleSelection, onTagSelected }} />
              ))}
          </ul>
        </li>
      ))}
    </ul>
  );
};

const getSectionStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      list-style: none;
    `,
    section: css`
      background: ${theme.colors.panelBg};
      border-bottom: solid 1px ${theme.isLight ? theme.colors.gray95 : theme.colors.gray25};
      padding: 0px 4px 4px 4px;
      margin-bottom: 3px;
    `,
  };
});

interface SectionHeaderProps {
  section: DashboardSection;
  onSectionClick: (section: DashboardSection) => void;
  onToggleSelection: ItemClickWithEvent;
  editable: boolean;
}

const SectionHeader: FC<SectionHeaderProps> = ({ section, onSectionClick, onToggleSelection, editable }) => {
  const theme = useTheme();
  const styles = getSectionHeaderStyles(theme, section.selected);

  const expandSection = () => {
    onSectionClick(section);
  };

  return !section.hideHeader ? (
    <div className={styles.wrapper} onClick={expandSection}>
      <SearchCheckbox
        editable={editable}
        checked={section.checked}
        onClick={(e: MouseEvent) => onToggleSelection(section, e)}
      />
      <Icon className={styles.icon} name={section.icon as IconType} />

      <span className={styles.text}>{section.title}</span>
      {section.url && (
        <a href={section.url} className={styles.link}>
          <Icon name="cog" />
        </a>
      )}
      <Icon name={section.expanded ? 'angle-down' : 'angle-right'} className={styles.toggle} />
    </div>
  ) : (
    <div className={styles.wrapper} />
  );
};

const getSectionHeaderStyles = stylesFactory((theme: GrafanaTheme, selected = false) => {
  const { sm, xs } = theme.spacing;
  return {
    wrapper: cx(
      css`
        display: flex;
        align-items: center;
        font-size: ${theme.typography.size.base};
        padding: ${sm} ${xs} ${xs};
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
      padding: 5px 0;
      width: 43px;
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
    toggle: css`
      padding: 5px;
    `,
  };
});
