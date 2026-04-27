import { css } from '@emotion/css';
import { Fragment, type ReactNode, useMemo } from 'react';
import { useMeasure } from 'react-use';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { PanelData, PanelPluginMeta, PanelPluginVisualizationSuggestion } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { MIN_MULTI_COLUMN_SIZE } from 'app/features/panel/suggestions/constants';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';

export interface VisualizationCardGridGroup {
  meta: PanelPluginMeta | undefined;
  items: PanelPluginVisualizationSuggestion[];
}

export interface Props {
  items?: PanelPluginVisualizationSuggestion[];
  groups?: VisualizationCardGridGroup[];
  data: PanelData;
  onItemClick: (item: PanelPluginVisualizationSuggestion, index: number) => void;
  getItemKey: (item: PanelPluginVisualizationSuggestion) => string;
  selectedKey?: string;
  minColumnWidth?: number;
  maxCardWidth?: number;
  getBadge?: (item: PanelPluginVisualizationSuggestion) => ReactNode;
}

export function VisualizationCardGrid({
  items,
  groups,
  data,
  onItemClick,
  getItemKey,
  selectedKey,
  minColumnWidth,
  maxCardWidth,
  getBadge,
}: Props) {
  const styles = useStyles2(getStyles, minColumnWidth, maxCardWidth);
  const [firstCardRef, { width }] = useMeasure<HTMLDivElement>();

  const itemIndexMap = useMemo(() => {
    const map = new Map<string, number>();

    if (groups) {
      let index = 0;
      groups.forEach((group) => {
        group.items.forEach((item) => {
          map.set(getItemKey(item), index++);
        });
      });
    } else if (items) {
      items.forEach((item, idx) => {
        map.set(getItemKey(item), idx);
      });
    }

    return map;
  }, [items, groups, getItemKey]);

  const renderCard = (item: PanelPluginVisualizationSuggestion, isFirst: boolean) => {
    const itemKey = getItemKey(item);
    const itemIndex = itemIndexMap.get(itemKey) ?? -1;
    const badge = getBadge?.(item);

    return (
      <div
        key={itemKey}
        className={styles.cardContainer}
        tabIndex={0}
        role="button"
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            onItemClick(item, itemIndex);
          }
        }}
        ref={isFirst ? firstCardRef : undefined}
      >
        <VisualizationSuggestionCard
          data={data}
          suggestion={item}
          width={width}
          isSelected={getItemKey(item) === selectedKey}
          onClick={() => onItemClick(item, itemIndex)}
        />
        {badge}
      </div>
    );
  };

  if (groups) {
    return (
      <div className={styles.grid}>
        {groups.map((group, groupIndex) => (
          <Fragment key={group.meta?.id || `unknown-viz-type-${groupIndex}`}>
            <div className={styles.vizTypeHeader}>
              <Text variant="body" weight="medium">
                {group.meta?.info && <img className={styles.vizTypeLogo} src={group.meta.info.logos.small} alt="" />}
                {group.meta?.name ||
                  t('panel.visualization-suggestions.unknown-viz-type', 'Unknown visualization type')}
              </Text>
            </div>
            {group.items.map((item, index) => renderCard(item, groupIndex === 0 && index === 0))}
          </Fragment>
        ))}
      </div>
    );
  }

  return <div className={styles.grid}>{items?.map((item, index) => renderCard(item, index === 0))}</div>;
}

const getStyles = (theme: GrafanaTheme2, minColumnWidth = MIN_MULTI_COLUMN_SIZE, maxCardWidth?: number) => ({
  grid: css({
    display: 'grid',
    gridGap: theme.spacing(1),
    gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
    marginBottom: theme.spacing(1),
  }),
  cardContainer: css({
    position: 'relative',
    width: '100%',
    maxWidth: maxCardWidth,
    justifySelf: 'start',
  }),
  vizTypeHeader: css({
    gridColumn: '1 / -1',
    marginBottom: theme.spacing(0.5),
    marginTop: theme.spacing(2),
    '&:first-of-type': {
      marginTop: 0,
    },
  }),
  vizTypeLogo: css({
    filter: 'grayscale(100%)',
    maxHeight: `${theme.typography.body.lineHeight}em`,
    width: `${theme.typography.body.lineHeight}em`,
    alignItems: 'center',
    display: 'inline-block',
    marginRight: theme.spacing(1),
  }),
});
