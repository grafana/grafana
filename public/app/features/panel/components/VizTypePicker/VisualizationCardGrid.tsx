import { css } from '@emotion/css';
import { Fragment, useMemo } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2, PanelData, PanelPluginMeta, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Text, useStyles2 } from '@grafana/ui';
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
  selectedItemKey: string | null;
  onItemClick: (item: PanelPluginVisualizationSuggestion, index: number) => void;
  onItemApply: (item: PanelPluginVisualizationSuggestion, index: number) => void;
  getItemKey: (item: PanelPluginVisualizationSuggestion) => string;
  buttonLabel: string;
  getButtonAriaLabel: (item: PanelPluginVisualizationSuggestion) => string;
}

export function VisualizationCardGrid({
  items,
  groups,
  data,
  selectedItemKey,
  onItemClick,
  onItemApply,
  getItemKey,
  buttonLabel,
  getButtonAriaLabel,
}: Props) {
  const styles = useStyles2(getStyles);
  const [firstCardRef, { width }] = useMeasure<HTMLDivElement>();
  const isNewVizSuggestionsEnabled = config.featureToggles.newVizSuggestions;

  const itemIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;

    if (groups) {
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
    const isCardSelected = selectedItemKey === itemKey;
    const itemIndex = itemIndexMap.get(itemKey) ?? -1;

    return (
      <div
        key={itemKey}
        className={styles.cardContainer}
        tabIndex={0}
        role="button"
        aria-pressed={isCardSelected}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            onItemClick(item, itemIndex);
          }
        }}
        ref={isFirst ? firstCardRef : undefined}
      >
        {isCardSelected && (
          <Button
            tabIndex={-1}
            variant="primary"
            size="md"
            className={styles.applySuggestionButton}
            data-testid={selectors.components.VisualizationPreview.confirm(item.name)}
            aria-label={getButtonAriaLabel(item)}
            onClick={() => onItemApply(item, itemIndex)}
          >
            {buttonLabel}
          </Button>
        )}
        <VisualizationSuggestionCard
          data={data}
          suggestion={item}
          width={width}
          isSelected={isCardSelected}
          onClick={() => onItemClick(item, itemIndex)}
        />
      </div>
    );
  };

  if (groups && isNewVizSuggestionsEnabled) {
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    grid: css({
      display: 'grid',
      gridGap: theme.spacing(1),
      gridTemplateColumns: `repeat(auto-fit, minmax(${MIN_MULTI_COLUMN_SIZE}px, 1fr))`,
      marginBottom: theme.spacing(1),
      justifyContent: 'space-evenly',
    }),
    cardContainer: css({
      position: 'relative',
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
    applySuggestionButton: css({
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
      padding: theme.spacing(0, 2),
    }),
  };
};
