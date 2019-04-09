import { GraphSeriesXY } from '../../types/graph';
import { useState } from 'react';
import union from 'lodash/union';
import difference from 'lodash/difference';
import { LegendItem } from '../Legend/Legend';

export const useSeriesVisibility = (series: GraphSeriesXY[]) => {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  return {
    hiddenSeries,
    hideSeries: (seriesToHide: string[]) => {
      setHiddenSeries(union(hiddenSeries, seriesToHide));
    },
    showSeries: (seriesToShow: string[]) => {
      setHiddenSeries(difference(hiddenSeries, seriesToShow));
    },
    visibleSeries: series.filter(s => {
      return hiddenSeries.indexOf(s.label) > -1;
    }),
    isSeriesVisible: (seriesLabel: string) => {
      return hiddenSeries.indexOf(seriesLabel) === -1;
    },
  };
};

export const useGraphLegend = (data: GraphSeriesXY[]) => {
  const seriesVisibilityAPI = useSeriesVisibility(data);

  const legendItems: LegendItem[] = data.map<LegendItem>(series => {
    return {
      label: series.label,
      color: series.color,
      isVisible: seriesVisibilityAPI.isSeriesVisible(series.label),
      stats: Object.keys(series.stats).map(statId => {
        return {
          statId,
          value: series.stats[statId],
        };
      }),
    };
  });

  return {
    ...seriesVisibilityAPI,
    legendItems,
  };
};
