// Library
import React, { useCallback, useMemo } from 'react';
import { compareDataFrameStructures, DataFrame } from '@grafana/data';

// Types
import { VizOrientation } from '@grafana/data';
import { Themeable } from '../../types';
import { BarChartOptions } from './types';
import { useRevision } from '../uPlot/hooks';

export interface Props extends Themeable, BarChartOptions {
  height: number;
  width: number;
  data: DataFrame;
}

export const BarChart: React.FunctionComponent<Props> = props => {
  if (!props.data || props.data.fields.length < 2) {
    return <div>Missing data</div>;
  }

  // dominik? TODO? can this all be moved into `useRevision`
  const compareFrames = useCallback((a?: DataFrame | null, b?: DataFrame | null) => {
    if (a && b) {
      return compareDataFrameStructures(a, b);
    }
    return false;
  }, []);
  const configRev = useRevision(props.data, compareFrames);

  const plotConfig = useMemo(() => {
    let orientation = props.orientation;
    if (!orientation || orientation === VizOrientation.Auto) {
      orientation = props.width - props.height > 0 ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }

    return {
      todo: 'plot config... changes only when structure changes',
      orientation,
    };
  }, [props.data, configRev, props.orientation, props.width, props.height]);

  return (
    <div>
      TODO... show panel...
      <pre>{JSON.stringify(plotConfig)}</pre>
    </div>
  );
};
