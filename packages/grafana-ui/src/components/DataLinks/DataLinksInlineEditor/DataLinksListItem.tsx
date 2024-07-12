import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';

import { DataFrame, DataLink, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { isCompactUrl } from '../../../utils/dataLinks';
import { FieldValidationMessage } from '../../Forms/FieldValidationMessage';
import { Icon } from '../../Icon/Icon';
import { IconButton } from '../../IconButton/IconButton';

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
        <>
          <div
            className={cx(styles.wrapper, styles.dragRow)}
            ref={provided.innerRef}
            {...provided.draggableProps}
            key={index}
          >
            <div className={cx(styles.dragHandle, styles.icons)} {...provided.dragHandleProps}>
              <Icon name="draggabledots" size="lg" />
            </div>

            <div className={styles.linkDetails}>
              <div className={cx(styles.url, !hasUrl && styles.notConfigured, isCompactExploreUrl && styles.errored)}>
                {hasTitle ? title : 'Data link title not provided'}
              </div>
              <div
                className={cx(styles.url, !hasUrl && styles.notConfigured, isCompactExploreUrl && styles.errored)}
                title={url}
              >
                {hasUrl ? url : 'Data link url not provided'}
              </div>
              {isCompactExploreUrl && (
                <FieldValidationMessage>
                  Explore data link may not work in the future. Please edit.
                </FieldValidationMessage>
              )}
            </div>
            <div>
              <IconButton name="pen" onClick={onEdit} tooltip="Edit data link title" />
              <IconButton name="times" onClick={onRemove} tooltip="Remove data link title" />
            </div>
          </div>
        </>
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
      width: '100%',
      marginBottom: theme.spacing(2),
      padding: '10px 0 0 10px',
      '&:last-child': {
        marginBottom: 0,
      },
    }),
    linkDetails: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
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
    dragRow: css({
      position: 'relative',
    }),
    icons: css({
      display: 'flex',
      padding: 6,
      alignItems: 'center',
      gap: 8,
    }),
    dragHandle: css({
      cursor: 'grab',
      // create focus ring around the whole row when the drag handle is tab-focused
      // needs position: relative on the drag row to work correctly
      '&:focus-visible&:after': {
        bottom: 0,
        content: '""',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: '-2px',
      },
    }),
  };
};
