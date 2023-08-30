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
          <IconButton name="pen" onClick={onEdit} tooltip="Edit data link title" />
          <IconButton name="times" onClick={onRemove} tooltip="Remove data link title" />
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
    wrapper: css({
      marginBottom: theme.spacing(2),
      width: '100%',
      '&:last-child': {
        marginBottom: 0,
      },
      display: 'flex',
      flexDirection: 'column',
    }),
    titleWrapper: css({
      label: 'data-links-list-item-title',
      justifyContent: 'space-between',
      display: 'flex',
      width: '100%',
      alignItems: 'center',
    }),
    actionButtons: css({
      marginLeft: theme.spacing(1),
      display: 'flex',
    }),
    errored: css({
      color: theme.colors.error.text,
      fontStyle: 'italic',
    }),
    notConfigured: css({
      fontStyle: 'italic',
    }),
    title: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    url: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '90%',
    }),
  };
});
