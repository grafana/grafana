import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';

import { Action, DataFrame, DataLink, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Badge } from '../../Badge/Badge';
import { Icon } from '../../Icon/Icon';
import { IconButton } from '../../IconButton/IconButton';

export interface DataLinksListItemBaseProps<T extends DataLink | Action> {
  index: number;
  item: T;
  data: DataFrame[];
  onChange: (index: number, item: T) => void;
  onEdit: () => void;
  onRemove: () => void;
  isEditing?: boolean;
  itemKey: string;
}

/** @internal */
export function DataLinksListItemBase<T extends DataLink | Action>({
  item,
  onEdit,
  onRemove,
  index,
  itemKey,
}: DataLinksListItemBaseProps<T>) {
  const styles = useStyles2(getDataLinkListItemStyles);
  const { title = '', oneClick = false } = item;

  // @ts-ignore - https://github.com/microsoft/TypeScript/issues/27808
  const url = item.url ?? item.fetch?.url ?? '';

  const hasTitle = title.trim() !== '';
  const hasUrl = url.trim() !== '';

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
            <div className={cx(styles.url, !hasTitle && styles.notConfigured)}>
              {hasTitle ? title : t('grafana-ui.data-links-inline-editor.title-not-provided', 'Title not provided')}
            </div>
            <div className={cx(styles.url, !hasUrl && styles.notConfigured)} title={url}>
              {hasUrl ? url : t('grafana-ui.data-links-inline-editor.url-not-provided', 'Data link url not provided')}
            </div>
          </div>
          <div className={styles.icons}>
            {oneClick && (
              <Badge
                color="blue"
                text={t('grafana-ui.data-links-inline-editor.one-click', 'One click')}
                tooltip={t('grafana-ui.data-links-inline-editor.one-click-enabled', 'One click enabled')}
              />
            )}
            <IconButton
              name="pen"
              onClick={onEdit}
              className={styles.icon}
              tooltip={t('grafana-ui.data-links-inline-editor.tooltip-edit', 'Edit')}
            />
            <IconButton
              name="trash-alt"
              onClick={onRemove}
              className={styles.icon}
              tooltip={t('grafana-ui.data-links-inline-editor.tooltip-remove', 'Remove')}
            />
            <div className={styles.dragIcon} {...provided.dragHandleProps}>
              <Icon name="draggabledots" size="lg" />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

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
