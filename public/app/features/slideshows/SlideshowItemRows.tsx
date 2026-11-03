import { css } from '@emotion/css';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getPlaylistItemKind } from '@grafana/runtime';
import { Icon, IconButton, Input, Spinner, Stack, useStyles2 } from '@grafana/ui';

import { type SlideshowItemDraft } from './types';

interface Props {
  items: SlideshowItemDraft[];
  defaultInterval: string;
  onDelete: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onIntervalChange: (index: number, interval: string) => void;
}

export function SlideshowItemRows({ items, defaultInterval, onDelete, onMove, onIntervalChange }: Props) {
  if (!items.length) {
    return (
      <em>
        <Trans i18nKey="slideshows.edit.items-empty">This slideshow is empty. Add items below.</Trans>
      </em>
    );
  }

  return (
    <div role="list">
      {items.map((item, index) => (
        <ItemRow
          key={`${index}/${item.group}/${item.resource}/${item.name}`}
          item={item}
          index={index}
          isLast={index === items.length - 1}
          defaultInterval={defaultInterval}
          onDelete={onDelete}
          onMove={onMove}
          onIntervalChange={onIntervalChange}
        />
      ))}
    </div>
  );
}

interface RowProps extends Omit<Props, 'items'> {
  item: SlideshowItemDraft;
  index: number;
  isLast: boolean;
}

function ItemRow({ item, index, isLast, defaultInterval, onDelete, onMove, onIntervalChange }: RowProps) {
  const styles = useStyles2(getStyles);
  const kind = getPlaylistItemKind(item.group, item.resource);
  const id = `${item.group}/${item.resource}/${item.name}`;

  const resolved = useAsync(async () => {
    if (!kind) {
      return undefined;
    }
    try {
      return await kind.resolve(item.name);
    } catch {
      return undefined;
    }
  }, [kind, item.name]);

  let label: React.ReactNode;
  let icon: 'exclamation-triangle' | NonNullable<typeof kind>['icon'] = 'exclamation-triangle';
  if (!kind) {
    label = (
      <Trans i18nKey="slideshows.edit.item-unknown-kind" values={{ id }}>
        Unknown kind: {'{{id}}'}
      </Trans>
    );
  } else if (resolved.loading) {
    label = <Spinner />;
    icon = kind.icon;
  } else if (!resolved.value) {
    label = (
      <Trans i18nKey="slideshows.edit.item-not-found" values={{ id }}>
        Not found: {'{{id}}'}
      </Trans>
    );
  } else {
    icon = kind.icon;
    label = (
      <>
        <span className={styles.kind}>{kind.title}</span> {resolved.value.title}
      </>
    );
  }

  return (
    <div className={styles.row} role="listitem">
      <Stack alignItems="center" gap={1}>
        <Icon name={icon} />
        {label}
      </Stack>
      <Stack alignItems="center" gap={1}>
        <Input
          width={10}
          value={item.interval ?? ''}
          placeholder={defaultInterval}
          aria-label={t('slideshows.edit.item-interval', 'Interval for item {{position}}', { position: index + 1 })}
          onChange={(e) => onIntervalChange(index, e.currentTarget.value)}
        />
        <IconButton
          name="arrow-up"
          disabled={index === 0}
          tooltip={t('slideshows.edit.item-move-up', 'Move item up')}
          onClick={() => onMove(index, index - 1)}
        />
        <IconButton
          name="arrow-down"
          disabled={isLast}
          tooltip={t('slideshows.edit.item-move-down', 'Move item down')}
          onClick={() => onMove(index, index + 1)}
        />
        <IconButton
          name="times"
          tooltip={t('slideshows.edit.item-delete', 'Delete item')}
          onClick={() => onDelete(index)}
        />
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0.75),
      marginBottom: theme.spacing(0.5),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    }),
    kind: css({
      color: theme.colors.text.secondary,
    }),
  };
}
