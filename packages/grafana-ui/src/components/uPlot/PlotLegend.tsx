import { css } from '@emotion/css';
import { memo, useCallback, useMemo, useState } from 'react';

import {
  type DataFrame,
  type GrafanaTheme2,
  extractFacetedLabels,
  getFieldDisplayName,
  getFieldSeriesColor,
  reduceField,
  ReducerID,
  resolveFacetedFilterNames,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizLegendOptions, AxisPlacement } from '@grafana/schema';

import { SeriesVisibilityChangeMode } from '../../components/PanelChrome/types';
import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { usePanelContext } from '../PanelChrome';
import { Toggletip } from '../Toggletip/Toggletip';
import { VizLayout, type VizLayoutLegendProps } from '../VizLayout/VizLayout';
import { FacetedLabelsFilter } from '../VizLegend/FacetedLabelsFilter';
import { VizLegend } from '../VizLegend/VizLegend';
import { type VizLegendItem } from '../VizLegend/types';

import { type UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import { getDisplayValuesForCalcs } from './utils';

interface PlotLegendProps extends VizLegendOptions, Omit<VizLayoutLegendProps, 'children'> {
  data: DataFrame[];
  config: UPlotConfigBuilder;
  enableFacetedFilter?: boolean;
}

/**
 * mostly duplicates logic in PlotLegend below :(
 *
 * @internal
 */
export function hasVisibleLegendSeries(config: UPlotConfigBuilder, data: DataFrame[]) {
  return config.getSeries().some((s) => {
    const fieldIndex = s.props.dataFrameFieldIndex;

    if (!fieldIndex) {
      return false;
    }

    const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

    if (!field || field.config.custom?.hideFrom?.legend) {
      return false;
    }

    if (reduceField({ field, reducers: [ReducerID.allIsNull] })[ReducerID.allIsNull]) {
      return false;
    }

    return true;
  });
}

export const PlotLegend = memo(function PlotLegend({
  data,
  config,
  placement,
  calcs,
  displayMode,
  limit,
  enableFacetedFilter = false,
  ...vizLayoutLegendProps
}: PlotLegendProps) {
  const theme = useTheme2();
  const styles = useStyles2(getPlotLegendStyles);
  const { onToggleSeriesVisibility } = usePanelContext();

  const [selectedLabels, setSelectedLabels] = useState<Record<string, string[]>>({});
  const [filterDocked, setFilterDocked] = useState(false);

  const facetedLabels = useMemo(
    () => (enableFacetedFilter && onToggleSeriesVisibility ? extractFacetedLabels(data) : {}),
    [enableFacetedFilter, onToggleSeriesVisibility, data]
  );
  const hasFacetedLabels = Object.keys(facetedLabels).length > 0;
  const hasActiveFilters = Object.values(selectedLabels).some((v) => v.length > 0);

  const legendItems = config
    .getSeries()
    .map<VizLegendItem | undefined>((s) => {
      const seriesConfig = s.props;
      const fieldIndex = seriesConfig.dataFrameFieldIndex;
      const axisPlacement = config.getAxisPlacement(s.props.scaleKey);

      if (!fieldIndex) {
        return undefined;
      }

      const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

      if (!field || field.config.custom?.hideFrom?.legend) {
        return undefined;
      }

      const allIsNull = reduceField({ field, reducers: [ReducerID.allIsNull] })[ReducerID.allIsNull];
      if (allIsNull) {
        return undefined;
      }

      const label = getFieldDisplayName(field, data[fieldIndex.frameIndex]!, data);
      const scaleColor = getFieldSeriesColor(field, theme);
      const seriesColor = scaleColor.color;

      return {
        disabled: !(seriesConfig.show ?? true),
        fieldIndex,
        color: seriesColor,
        label,
        yAxis: axisPlacement === AxisPlacement.Left || axisPlacement === AxisPlacement.Bottom ? 1 : 2,
        getDisplayValues: () => getDisplayValuesForCalcs(calcs, field, theme),
        getItemKey: () => `${label}-${fieldIndex.frameIndex}-${fieldIndex.fieldIndex}`,
        lineStyle: seriesConfig.lineStyle,
      };
    })
    .filter((i): i is VizLegendItem => i !== undefined);

  const legendHasPrecedence = useMemo(() => {
    if (!hasActiveFilters) {
      return false;
    }

    const expectedVisible = resolveFacetedFilterNames(data, selectedLabels, getFieldDisplayName);
    if (!expectedVisible) {
      return false;
    }

    const expectedSet = new Set(expectedVisible);
    const actuallyVisible = new Set(legendItems.filter((item) => !item.disabled).map((item) => item.label));

    if (expectedSet.size !== actuallyVisible.size) {
      return true;
    }

    return !Array.from(expectedSet).every((name) => actuallyVisible.has(name));
  }, [hasActiveFilters, data, selectedLabels, legendItems]);

  const handleLabelsChange = useCallback(
    (selected: Record<string, string[]>) => {
      setSelectedLabels(selected);
      const visibleNames = resolveFacetedFilterNames(data, selected, getFieldDisplayName);
      onToggleSeriesVisibility?.(visibleNames, SeriesVisibilityChangeMode.SetExactly);
    },
    [data, onToggleSeriesVisibility]
  );

  const handleClearFilters = useCallback(() => {
    setSelectedLabels({});
    onToggleSeriesVisibility?.(null, SeriesVisibilityChangeMode.SetExactly);
  }, [onToggleSeriesVisibility]);

  const handleToggleFilterDock = useCallback(() => {
    setFilterDocked((prev) => !prev);
  }, []);

  const facetedFilter = hasFacetedLabels ? (
    <FacetedLabelsFilter
      labels={facetedLabels}
      selected={selectedLabels}
      onChange={handleLabelsChange}
      dimmed={legendHasPrecedence}
    />
  ) : null;

  const filterToggle = facetedFilter ? (
    <Toggletip
      content={
        <div className={styles.filterPopoverContent}>
          {facetedFilter}
          <div className={styles.filterPopoverFooter}>
            <Button variant="secondary" size="sm" icon="gf-pin" onClick={handleToggleFilterDock}>
              {t('grafana-ui.viz-legend.pin-filter', 'Pin to sidebar')}
            </Button>
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" icon="times" onClick={handleClearFilters}>
                {t('grafana-ui.viz-legend.clear-filters', 'Clear all')}
              </Button>
            )}
          </div>
        </div>
      }
      placement="bottom-start"
      fitContent
      dismissOnScroll
    >
      <IconButton
        name="eye"
        size="md"
        tooltip={t('grafana-ui.viz-legend.series-visibility', 'Series visibility')}
        variant={hasActiveFilters ? 'primary' : undefined}
        data-testid="faceted-labels-filter-toggle"
      />
    </Toggletip>
  ) : null;

  const legend = (
    <VizLegend
      placement={placement}
      items={legendItems}
      displayMode={displayMode}
      sortBy={vizLayoutLegendProps.sortBy}
      sortDesc={vizLayoutLegendProps.sortDesc}
      isSortable={true}
      limit={limit}
      filterAction={!filterDocked ? filterToggle : undefined}
    />
  );

  if (filterDocked && facetedFilter) {
    return (
      <VizLayout.Legend placement={placement} {...vizLayoutLegendProps}>
        <div className={styles.legendWithFilter}>
          <div className={styles.filterContent}>
            <div className={styles.filterDockedActions}>
              {hasActiveFilters && (
                <IconButton
                  name="filter-minus"
                  size="sm"
                  tooltip={t('grafana-ui.viz-legend.clear-filters', 'Clear all')}
                  onClick={handleClearFilters}
                />
              )}
              <IconButton
                name="times"
                size="sm"
                tooltip={t('grafana-ui.viz-legend.unpin-sidebar', 'Unpin')}
                onClick={handleToggleFilterDock}
              />
            </div>
            {facetedFilter}
          </div>
          <div className={styles.legendContent}>{legend}</div>
        </div>
      </VizLayout.Legend>
    );
  }

  return (
    <VizLayout.Legend placement={placement} {...vizLayoutLegendProps}>
      {legend}
    </VizLayout.Legend>
  );
});

PlotLegend.displayName = 'PlotLegend';

const getPlotLegendStyles = (theme: GrafanaTheme2) => ({
  legendWithFilter: css({
    display: 'flex',
    width: '100%',
    height: '100%',
    gap: theme.spacing(1),
    overflow: 'hidden',
  }),
  legendContent: css({
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
  }),
  filterContent: css({
    position: 'relative',
    flexShrink: 0,
    overflow: 'auto',
    borderRight: `1px solid ${theme.colors.border.weak}`,
    paddingRight: theme.spacing(1),
  }),
  filterDockedActions: css({
    position: 'absolute',
    zIndex: 1,
    right: theme.spacing(0.5),
    top: theme.spacing(0.5),
    display: 'flex',
    gap: theme.spacing(0.25),
    color: theme.colors.text.secondary,
  }),
  filterPopoverContent: css({
    margin: theme.spacing(-3, -2),
    maxHeight: 400,
    overflow: 'auto',
  }),
  filterPopoverFooter: css({
    display: 'flex',
    gap: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
});
