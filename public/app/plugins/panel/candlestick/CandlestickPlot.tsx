import React from 'react';
import { AlignedData } from 'uplot';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Themeable2, UPlotConfigBuilder, UPlotChart, VizLayout, ScaleDirection, ScaleOrientation } from '@grafana/ui';

import { PanelOptions } from './models.gen';
import { ScaleDistribution } from '@grafana/ui/src/components/uPlot/models.gen';
import { CandlestickFields } from './types';

export interface CandlestickProps extends Themeable2 {
  options: PanelOptions; // used for diff
  fields: CandlestickFields; // This could take CandlestickFields
  width: number;
  height: number;
  structureRev?: number; // a number that will change when the frames[] structure changes
  //  legend: VizLegendOptions;
  children?: (builder: UPlotConfigBuilder, frame: DataFrame) => React.ReactNode;
}

const prepConfig = (fields: CandlestickFields, theme: GrafanaTheme2) => {
  let builder = new UPlotConfigBuilder();

  builder.addScale({
    scaleKey: 'x', // bukkits
    isTime: true,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
  });

  builder.addScale({
    scaleKey: 'y', // counts
    isTime: false,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
  });

  return builder;
};

const preparePlotData = (fields: CandlestickFields) => {
  let data: AlignedData = [] as any;

  // HACK!
  data.push(fields.time.values.toArray());
  data.push(fields.open!.values.toArray());
  data.push(fields.high!.values.toArray());
  data.push(fields.low!.values.toArray());
  data.push(fields.close!.values.toArray());
  data.push(fields.volume!.values.toArray());

  /*
  for (const s of fields.series) {
    data.push(s.values.toArray());
  }
  */

  console.log(data);

  return data;
};

interface State {
  alignedData: AlignedData; // from the original frame
  config?: UPlotConfigBuilder;
}

export class CandlestickPlot extends React.Component<CandlestickProps, State> {
  constructor(props: CandlestickProps) {
    super(props);
    this.state = this.prepState(props);
  }

  prepState(props: CandlestickProps, withConfig = true) {
    let state: State = null as any;

    const { fields } = props;
    if (fields) {
      state = {
        alignedData: preparePlotData(fields),
      };

      if (withConfig) {
        state.config = prepConfig(fields, this.props.theme);
      }
    }

    return state;
  }

  renderLegend(config: UPlotConfigBuilder) {
    // const { legend } = this.props;
    // if (!config || legend.displayMode === LegendDisplayMode.Hidden) {
    //   return null;
    // }

    return null; //<PlotLegend data={[this.props.alignedFrame]} config={config} maxHeight="35%" maxWidth="60%" {...legend} />;
  }

  componentDidUpdate(prevProps: CandlestickProps) {
    const { structureRev, fields } = this.props;

    if (fields !== prevProps.fields) {
      let newState = this.prepState(this.props, false);

      if (newState) {
        const shouldReconfig =
          this.props.options !== prevProps.options ||
          this.state.config === undefined ||
          structureRev !== prevProps.structureRev ||
          !structureRev;

        if (shouldReconfig) {
          newState.config = prepConfig(fields, this.props.theme);
        }
      }

      newState && this.setState(newState);
    }
  }

  render() {
    const { width, height, children } = this.props;
    const { config } = this.state;

    if (!config) {
      return null;
    }

    // ???? hack for children ???
    const alignedFrame: DataFrame = { fields: [], length: 0 };

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend(config)}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={this.state.config!}
            data={this.state.alignedData}
            width={vizWidth}
            height={vizHeight}
            timeRange={null as any}
          >
            {children ? children(config, alignedFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}
