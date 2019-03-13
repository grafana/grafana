// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processSingleStatPanelData, SingleStatOptions, DisplayValue, PanelProps, VizOrientation } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { VizRepeater, getDisplayProcessor } from '@grafana/ui';

interface State {
  values: DisplayValue[];
}

export class SingleStatPanel<T extends SingleStatOptions> extends PureComponent<PanelProps<T>, State> {
  constructor(props: PanelProps<T>) {
    super(props);

    // if (props.options.valueOptions) {
    //   console.warn('TODO!! how do we best migration options?');
    // }

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
    const { display } = options;

    const processor = getDisplayProcessor({
      ...display,
      prefix: replaceVariables(display.prefix),
      suffix: replaceVariables(display.suffix),
      theme: config.theme,
    });

    return processSingleStatPanelData({
      panelData: panelData,
      stat: options.stat,
    }).map(stat => processor(stat.value));
  }

  /**
   * Subclasses can render this function
   *
   * @param value
   * @param width
   * @param height
   */
  renderStat(value: DisplayValue, width: number, height: number) {
    return <div style={{ width, height, border: '1px solid red' }}>{value.text}</div>;
  }

  // Or we could add this to single stat props?
  getOrientation(): VizOrientation {
    return VizOrientation.Auto;
  }

  render() {
    const { height, width } = this.props;
    const { values } = this.state;

    return (
      <VizRepeater height={height} width={width} values={values} orientation={this.getOrientation()}>
        {({ vizHeight, vizWidth, value }) => this.renderStat(value, vizWidth, vizHeight)}
      </VizRepeater>
    );
  }
}
