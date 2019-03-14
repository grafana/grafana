import React, { PureComponent } from 'react';
import { processSingleStatPanelData, DisplayValue, PanelProps } from '@grafana/ui';
import { config } from 'app/core/config';
import { VizRepeater, getDisplayProcessor } from '@grafana/ui';
import { SingleStatBaseOptions } from './types';

export interface State {
  values: DisplayValue[];
}

export class SingleStatBase<T extends SingleStatBaseOptions> extends PureComponent<PanelProps<T>, State> {
  constructor(props: PanelProps<T>) {
    super(props);
    this.state = {
      values: this.findDisplayValues(props),
    };
  }

  componentDidUpdate(prevProps: PanelProps<T>) {
    if (this.props.panelData !== prevProps.panelData) {
      this.setState({ values: this.findDisplayValues(this.props) });
    }
  }

  findDisplayValues(props: PanelProps<T>): DisplayValue[] {
    const { panelData, replaceVariables, options } = this.props;
    const { valueOptions, valueMappings } = options;
    const processor = getDisplayProcessor({
      unit: valueOptions.unit,
      decimals: valueOptions.decimals,
      mappings: valueMappings,
      thresholds: options.thresholds,

      prefix: replaceVariables(valueOptions.prefix),
      suffix: replaceVariables(valueOptions.suffix),
      theme: config.theme,
    });
    return processSingleStatPanelData({
      panelData: panelData,
      stat: valueOptions.stat,
    }).map(stat => processor(stat.value));
  }

  /**
   * Subclasses will fill in appropriatly
   */
  renderStat(value: DisplayValue, width: number, height: number) {
    return <div style={{ width, height, border: '1px solid red' }}>{value.text}</div>;
  }

  render() {
    const { height, width, options } = this.props;
    const { orientation } = options;
    const { values } = this.state;
    return (
      <VizRepeater height={height} width={width} values={values} orientation={orientation}>
        {({ vizHeight, vizWidth, value }) => this.renderStat(value, vizWidth, vizHeight)}
      </VizRepeater>
    );
  }
}
