import { css, cx } from '@emotion/css';
import React from 'react';

import { DataFrame, DataLink, GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../../themes';
import { isCompactUrl } from '../../../utils/dataLinks';
import { FieldValidationMessage } from '../../Forms/FieldValidationMessage';
import { IconButton } from '../../IconButton/IconButton';

export interface DataLinksListItemProps {
  index: number;
  link: DataLink;
  data: DataFrame[];
  onChange: (index: number, link: DataLink) => void;
  onEdit: () => void;
  onRemove: () => void;
  isEditing?: boolean;
}

export const DataLinksListItem = ({ link, onEdit, onRemove }: DataLinksListItemProps) => {
  const theme = useTheme2();
  const styles = getDataLinkListItemStyles(theme);
  const { title = '', url = '' } = link;

  const hasTitle = title.trim() !== '';
  const hasUrl = url.trim() !== '';

  const isCompactExploreUrl = isCompactUrl(url);

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleWrapper}>
        <div className={cx(styles.url, !hasUrl && styles.notConfigured, isCompactExploreUrl && styles.errored)}>
          {hasTitle ? title : 'Data link title not provided'}
        </div>
        <div className={styles.actionButtons}>
          <IconButton name="pen" onClick={onEdit} />
          <IconButton name="times" onClick={onRemove} />
        </div>
      </div>
      <div
        className={cx(styles.url, !hasUrl && styles.notConfigured, isCompactExploreUrl && styles.errored)}
        title={url}
      >
        {hasUrl ? url : 'Data link url not provided'}
      </div>
      {isCompactExploreUrl && (
        <FieldValidationMessage>Explore data link may not work in the future. Please edit.</FieldValidationMessage>
      )}
    </div>
  );
};

const getDataLinkListItemStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing(2)};
      width: 100%;
      &:last-child {
        margin-bottom: 0;
      }
      display: flex;
      flex-direction: column;
    `,
    titleWrapper: css`
      label: data-links-list-item-title;
      justify-content: space-between;
      display: flex;
      width: 100%;
      align-items: center;
    `,
    actionButtons: css`
      margin-left: ${theme.spacing(1)};
      display: flex;
    `,
    errored: css`
      color: ${theme.colors.error.text};
      font-style: italic;
    `,
    notConfigured: css`
      font-style: italic;
    `,
    title: css`
      color: ${theme.colors.text.primary};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    url: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90%;
    `,
  };
});
