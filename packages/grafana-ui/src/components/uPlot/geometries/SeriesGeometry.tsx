import { usePlotConfigContext } from '../context';
import { getAreaConfig, getLineConfig, getPointConfig } from './configGetters';
import React, { useCallback, useEffect, useRef } from 'react';
import uPlot from 'uplot';

const seriesGeometryAllowedGeometries = ['Line', 'Point', 'Area'];

export const useSeriesGeometry = (getConfig: () => any) => {
  const { addSeries } = usePlotConfigContext();
  const updateConfigRef = useRef<(c: uPlot.Series) => void>(() => {});

  const defaultSeriesConfig: uPlot.Series = {
    width: 0,
    points: {
      show: false,
    },
  };

  const getUpdateConfigRef = useCallback(() => {
    return updateConfigRef.current;
  }, [updateConfigRef]);

  useEffect(() => {
    const config = getConfig();
    const { removeSeries, updateSeries } = addSeries({ ...defaultSeriesConfig, ...config });
    updateConfigRef.current = updateSeries;
    return () => {
      removeSeries();
    };
  }, []);

  // update series config when config getter is updated
  useEffect(() => {
    const config = getConfig();
    getUpdateConfigRef()({ ...defaultSeriesConfig, ...config });
  }, [getConfig]);
};

const geometriesConfigGetters: Record<string, (props: any) => {}> = {
  Line: getLineConfig,
  Point: getPointConfig,
  Area: getAreaConfig,
};

export const SeriesGeometry: React.FC<{ scaleKey: string; children: React.ReactElement[] }> = props => {
  const getConfig = () => {
    let config: uPlot.Series = {
      points: {
        show: false,
      },
    };

    if (!props.children) {
      throw new Error('SeriesGeometry requires Line, Point or Area components as children');
    }

    React.Children.forEach<React.ReactElement>(props.children, child => {
      if (
        child.type &&
        (child.type as any).displayName &&
        seriesGeometryAllowedGeometries.indexOf((child.type as any).displayName) === -1
      ) {
        throw new Error(`Can't use ${child.type} in SeriesGeometry`);
      }
      config = { ...config, ...geometriesConfigGetters[(child.type as any).displayName](child.props) };
    });

    return config;
  };

  useSeriesGeometry(getConfig);

  return null;
};
