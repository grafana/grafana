import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { DataFrame, DataLink, GrafanaTheme, VariableSuggestion } from '@grafana/data';
import { stylesFactory, useTheme } from '../../../themes';
import { HorizontalGroup, VerticalGroup } from '../../Layout/Layout';
import { IconButton } from '../../IconButton/IconButton';

interface DataLinksListItemProps {
  index: number;
  link: DataLink;
  data: DataFrame[];
  onChange: (index: number, link: DataLink) => void;
  onEdit: () => void;
  onRemove: () => void;
  suggestions: VariableSuggestion[];
  isEditing?: boolean;
}

export const DataLinksListItem: FC<DataLinksListItemProps> = ({ link, onEdit, onRemove }) => {
  const theme = useTheme();
  const styles = getDataLinkListItemStyles(theme);

  const hasTitle = link.title.trim() !== '';
  const hasUrl = link.url.trim() !== '';

  return (
    <div className={styles.wrapper}>
      <VerticalGroup spacing="xs">
        <HorizontalGroup justify="space-between" align="flex-start" width="100%">
          <div className={cx(styles.title, !hasTitle && styles.notConfigured)}>
            {hasTitle ? link.title : 'Data link title not provided'}
          </div>
          <HorizontalGroup>
            <IconButton name="pen" onClick={onEdit} />
            <IconButton name="times" onClick={onRemove} />
          </HorizontalGroup>
        </HorizontalGroup>
        <div className={cx(styles.url, !hasUrl && styles.notConfigured)} title={link.url}>
          {hasUrl ? link.url : 'Data link url not provided'}
        </div>
      </VerticalGroup>
    </div>
  );
};

const getDataLinkListItemStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing.md};
      width: 100%;
      &:last-child {
        margin-bottom: 0;
      }
    `,
    notConfigured: css`
      font-style: italic;
    `,
    title: css`
      color: ${theme.colors.formLabel};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
    `,
    url: css`
      color: ${theme.colors.textWeak};
      font-size: ${theme.typography.size.sm};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90%;
    `,
  };
});
