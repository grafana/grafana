import React, { FC, Dispatch } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme, IconName } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { DashboardSection, SearchAction } from '../types';
import { SearchItem } from './SearchItem';
import { SearchCheckbox } from './SearchCheckbox';
import { TOGGLE_CHECKED } from '../reducers/actionTypes';

export interface Props {
  dispatch: Dispatch<SearchAction>;
  editable?: boolean;
  loading?: boolean;
  onTagSelected: (name: string) => any;
  onToggleSection?: any;
  results: DashboardSection[] | undefined;
}

export const SearchResults: FC<Props> = ({ editable, dispatch, loading, onTagSelected, onToggleSection, results }) => {
  const theme = useTheme();
  const styles = getSectionStyles(theme);

  if (loading) {
    return <PageLoader />;
  } else if (!results || !results.length) {
    return <h6>No dashboards matching your query were found.</h6>;
  }

  return (
    <ul className={styles.wrapper}>
      {results.map(section => (
        <li aria-label="Search section" className={styles.section} key={section.title}>
          <SectionHeader onSectionClick={onToggleSection} {...{ dispatch, editable, section }} />
          <ul aria-label="Search items" className={styles.wrapper}>
            {section.expanded &&
              section.items.map(item => <SearchItem key={item.id} {...{ item, editable, dispatch, onTagSelected }} />)}
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
      border-bottom: solid 1px ${theme.isLight ? theme.palette.gray95 : theme.palette.gray25};
      padding: 0px 4px 4px 4px;
      margin-bottom: 3px;
    `,
  };
});

interface SectionHeaderProps {
  dispatch: Dispatch<SearchAction>;
  editable?: boolean;
  onSectionClick: (section: DashboardSection) => void;
  section: DashboardSection;
}

const SectionHeader: FC<SectionHeaderProps> = ({ section, onSectionClick, editable = false, dispatch }) => {
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
          dispatch({ type: TOGGLE_CHECKED, payload: section });
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
          <Icon name="cog" />
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
  };
});
