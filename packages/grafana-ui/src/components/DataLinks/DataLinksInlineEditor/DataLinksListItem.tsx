import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';

import { DataFrame, DataLink, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { isCompactUrl } from '../../../utils';
import { Icon } from '../../Icon/Icon';
import { IconButton } from '../../IconButton/IconButton';
import { Tooltip } from '../../Tooltip/Tooltip';

export interface DataLinksListItemProps {
  index: number;
  link: DataLink;
  data: DataFrame[];
  onChange: (index: number, link: DataLink) => void;
  onEdit: () => void;
  onRemove: () => void;
  isEditing?: boolean;
  itemKey: string;
}

export const DataLinksListItem = ({ link, onEdit, onRemove, index, itemKey }: DataLinksListItemProps) => {
  const styles = useStyles2(getDataLinkListItemStyles);
  const { title = '', url = '' } = link;

  const hasTitle = title.trim() !== '';
  const hasUrl = url.trim() !== '';

  const isCompactExploreUrl = isCompactUrl(url);

  return (
    <Draggable key={itemKey} draggableId={itemKey} index={index}>
      {(provided) => (
        <div
          className={cx(styles.wrapper, styles.dragRow)}
          ref={provided.innerRef}
          {...provided.draggableProps}
          key={index}
        >
          <div className={styles.linkDetails}>
            <div className={cx(styles.url, !hasUrl && styles.notConfigured, isCompactExploreUrl && styles.errored)}>
              {hasTitle ? title : 'Data link title not provided'}
            </div>
            <Tooltip content={'Explore data link may not work in the future. Please edit.'} show={isCompactExploreUrl}>
              <div
                className={cx(styles.url, !hasUrl && styles.notConfigured, isCompactExploreUrl && styles.errored)}
                title={url}
              >
                {hasUrl ? url : 'Data link url not provided'}
              </div>
            </Tooltip>
          </div>
          <div className={styles.icons}>
            <IconButton name="pen" onClick={onEdit} className={styles.icon} tooltip="Edit data link" />
            <IconButton name="trash-alt" onClick={onRemove} className={styles.icon} tooltip="Remove data link" />
            <div className={styles.dragIcon} {...provided.dragHandleProps}>
              <Icon name="draggabledots" size="lg" />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

const getDataLinkListItemStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '5px 0 5px 10px',
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      gap: 8,
    }),
    linkDetails: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      maxWidth: `calc(100% - 100px)`,
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
    }),
    dragRow: css({
      position: 'relative',
      margin: '8px',
    }),
    icons: css({
      display: 'flex',
      padding: 6,
      alignItems: 'center',
      gap: 8,
    }),
    dragIcon: css({
      cursor: 'grab',
      color: theme.colors.text.secondary,
      margin: theme.spacing(0, 0.5),
    }),
    icon: css({
      color: theme.colors.text.secondary,
    }),
  };
};
