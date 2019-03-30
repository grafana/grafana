import React, { PureComponent } from 'react';
import { VizOrientation } from '@grafana/ui';
import { VizRepeater } from '@grafana/ui';

export interface Props<T> {
  width: number;
  height: number;
  orientation: VizOrientation;
  source: any; // If this changes, the values will be processed
  renderCounter: number; // change to force processing

  getProcessedValues: () => T[];
  renderValue: (value: T, width: number, height: number) => JSX.Element;
}

interface State<T> {
  values: T[];
}

/**
 * This is essentially a cache of processed values.  This checks for changes
 * to the source and then saves the processed values in the State
 */
export class ProcessedValuesRepeater<T> extends PureComponent<Props<T>, State<T>> {
  constructor(props: Props<T>) {
    super(props);
    this.state = {
      values: props.getProcessedValues(),
    };
  }

  componentDidUpdate(prevProps: Props<T>) {
    const { renderCounter, source } = this.props;
    if (renderCounter !== prevProps.renderCounter || source !== prevProps.source) {
      this.setState({ values: this.props.getProcessedValues() });
    }
  }

  render() {
    const { orientation, height, width, renderValue } = this.props;
    const { values } = this.state;

    return (
      <VizRepeater height={height} width={width} values={values} orientation={orientation}>
        {({ vizHeight, vizWidth, value }) => renderValue(value, vizWidth, vizHeight)}
      </VizRepeater>
    );
  }
}
