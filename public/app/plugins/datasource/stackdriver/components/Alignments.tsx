import React from 'react';
import _ from 'lodash';

// import { OptionPicker } from './OptionPicker';
// import { alignmentPeriods } from '../constants';
// import { getAlignmentOptionsByMetric, getAggregationOptionsByMetric } from '../functions';
import { getAlignmentOptionsByMetric } from '../functions';
import { StackdriverPicker } from './StackdriverPicker';
// import kbn from 'app/core/utils/kbn';

export interface Props {
  onChange: (metricDescriptor) => void;
  templateSrv: any;
  metricDescriptor: {
    valueType: string;
    metricKind: string;
  };
  perSeriesAligner: string;
}

interface State {
  alignOptions: any[];
}

export class Alignments extends React.Component<Props, State> {
  state: State = {
    alignOptions: [],
  };

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (this.props.metricDescriptor !== null) {
      this.setAlignOptions(this.props);
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.metricDescriptor !== null) {
      this.setAlignOptions(nextProps);
    }
  }

  setAlignOptions({ metricDescriptor, perSeriesAligner, templateSrv, onChange }) {
    const alignOptions = getAlignmentOptionsByMetric(metricDescriptor.valueType, metricDescriptor.metricKind).map(
      option => ({
        ...option,
        label: option.text,
      })
    );
    if (!alignOptions.some(o => o.value === templateSrv.replace(perSeriesAligner))) {
      onChange(alignOptions.length > 0 ? alignOptions[0].value : '');
    }
    this.setState({ alignOptions });
  }

  render() {
    const { alignOptions } = this.state;
    const { perSeriesAligner, templateSrv, onChange } = this.props;

    return (
      <React.Fragment>
        <div className="gf-form-group">
          <div className="gf-form offset-width-9">
            <label className="gf-form-label query-keyword width-15">Aligner</label>
            <StackdriverPicker
              onChange={value => onChange(value)}
              selected={perSeriesAligner}
              templateVariables={templateSrv.variables}
              options={alignOptions}
              searchable={true}
              placeholder="Select Alignment"
              className="width-15"
              groupName="Alignment Options"
            />
          </div>
        </div>
      </React.Fragment>
    );
  }
}
