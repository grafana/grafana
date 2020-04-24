import React, { FC, useCallback } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Icon, IconButton, IconName, stylesFactory, useTheme } from '@grafana/ui';
import { DashboardSection, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';

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
  const styles = getSectionHeaderStyles(theme, section.selected);

  const onSectionExpand = () => {
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

  return !section.hideHeader ? (
    <div className={styles.wrapper} onClick={onSectionExpand}>
      <SearchCheckbox editable={editable} checked={section.checked} onClick={onSectionChecked} />
      <Icon className={styles.icon} name={section.icon as IconName} />

      <span className={styles.text}>{section.title}</span>
      {section.url && (
        <a href={section.url} className={styles.link}>
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
