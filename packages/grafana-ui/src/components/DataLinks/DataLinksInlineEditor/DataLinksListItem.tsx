import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { DataFrame, DataLink, GrafanaTheme, VariableSuggestion } from '@grafana/data';
import { selectThemeVariant, stylesFactory, useTheme } from '../../../themes';
import { HorizontalGroup } from '../../Layout/Layout';
import { Icon } from '../../Icon/Icon';

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

export const DataLinksListItem: FC<DataLinksListItemProps> = ({
  index,
  link,
  data,
  onChange,
  suggestions,
  isEditing,
  onEdit,
  onRemove,
}) => {
  const theme = useTheme();
  const styles = getDataLinkListItemStyles(theme);

  const hasTitle = link.title.trim() !== '';
  const hasUrl = link.url.trim() !== '';

  return (
    <div className={styles.wrapper}>
      <HorizontalGroup justify="space-between">
        <div>
          <div className={cx(!hasTitle && styles.notConfigured)}>{hasTitle ? link.title : 'No data link provided'}</div>
          <div className={cx(!hasUrl && styles.notConfigured, styles.url)}>{hasUrl ? link.url : 'No url provided'}</div>
        </div>

        <HorizontalGroup>
          <div onClick={onEdit} className={styles.action}>
            <Icon name="pencil" />
          </div>
          <div onClick={onRemove} className={cx(styles.action, styles.remove)}>
            <Icon name="trash" />
          </div>
        </HorizontalGroup>
      </HorizontalGroup>
    </div>
  );
};

const getDataLinkListItemStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray85,
      dark: theme.colors.dark9,
    },
    theme.type
  );
  const bg = selectThemeVariant(
    {
      light: theme.colors.white,
      dark: theme.colors.dark1,
    },
    theme.type
  );

  return {
    wrapper: css`
      border-bottom: 1px dashed ${borderColor};
      padding: ${theme.spacing.sm};
      transition: background 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      &:last-child {
        border-bottom: 0;
      }
      &:hover {
        background: ${bg};
      }
    `,
    action: css`
      cursor: pointer;
    `,

    notConfigured: css`
      font-style: italic;
    `,
    url: css`
      font-size: ${theme.typography.size.sm};
    `,
    remove: css`
      color: ${theme.colors.red88};
    `,
  };
});
