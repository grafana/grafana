import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme, IconName, IconButton, Spinner } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { DashboardSection, OnToggleChecked } from '../types';
import { SearchItem } from './SearchItem';
import { SearchCheckbox } from './SearchCheckbox';

export interface Props {
  editable?: boolean;
  loading?: boolean;
  onTagSelected: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
  onToggleSection?: (section: DashboardSection) => void;
  results: DashboardSection[] | undefined;
}

export const SearchResults: FC<Props> = ({
  editable,
  loading,
  onTagSelected,
  onToggleChecked,
  onToggleSection,
  results,
}) => {
  const theme = useTheme();
  const styles = getSectionStyles(theme);

  if (loading) {
    return <Spinner className={styles.spinner} />;
  } else if (!results || !results.length) {
    return <h6>No dashboards matching your query were found.</h6>;
  }

  return (
    <div className="search-results-container">
      <ul className={styles.wrapper}>
        {results.map(section => (
          <li aria-label="Search section" className={styles.section} key={section.title}>
            <SectionHeader onSectionClick={onToggleSection} {...{ onToggleChecked, editable, section }} />
            <ul aria-label="Search items" className={styles.wrapper}>
              {section.expanded &&
                section.items.map(item => (
                  <SearchItem key={item.id} {...{ item, editable, onToggleChecked, onTagSelected }} />
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

const getSectionStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      list-style: none;
    `,
    section: css`
      background: ${theme.colors.panelBg};
      border-bottom: solid 1px ${theme.isLight ? theme.palette.gray95 : theme.palette.gray25};
      padding: 0px 4px 4px 4px;
      margin-bottom: 3px;
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    `,
  };
});

interface SectionHeaderProps {
  onToggleChecked?: OnToggleChecked;
  editable?: boolean;
  onSectionClick: (section: DashboardSection) => void;
  section: DashboardSection;
}

const SectionHeader: FC<SectionHeaderProps> = ({ section, onSectionClick, editable = false, onToggleChecked }) => {
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
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleChecked(section);
        }}
      />
      <Icon className={styles.icon} name={section.icon as IconName} />

      <span className={styles.text}>{section.title}</span>
      {section.url && (
        <a
          href={section.url}
          className={styles.link}
          onClick={() => appEvents.emit(CoreEvents.hideDashSearch, { target: 'search-item' })}
        >
          <IconButton name="cog" className={styles.button} />
        </a>
      )}
      <Icon name={section.expanded ? 'angle-down' : 'angle-right'} />
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
    button: css`
      margin-top: 3px;
    `,
  };
});
