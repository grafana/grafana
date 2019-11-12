import React, { PureComponent, SyntheticEvent } from 'react';
import { DataSourceSettings } from '@grafana/data';
import { Button, FormLabel, Select } from '@grafana/ui';
import { GraphiteOptions, GraphiteType } from '../types';

const graphiteVersions = [
  { label: '0.9.x', value: '0.9' },
  { label: '1.0.x', value: '1.0' },
  { label: '1.1.x', value: '1.1' },
];

const graphiteTypes = Object.keys(GraphiteType).map((key: string) => ({
  name: key,
  value: (GraphiteType as any)[key],
}));

interface Props {
  value: DataSourceSettings<GraphiteOptions>;
  onChange: (value: DataSourceSettings<GraphiteOptions>) => void;
}

interface State {
  showMetricTankHelp: boolean;
}

export class GraphiteDetails extends PureComponent<Props, State> {
  static state = {
    showMetricTankHelp: false,
  };

  onChangeHandler = (key: keyof GraphiteOptions) => (event: SyntheticEvent<HTMLSelectElement>) => {
    const { value, onChange } = this.props;
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: event.currentTarget.value,
      },
    });
  };

  render() {
    const { value } = this.props;
    const { showMetricTankHelp } = this.state;

    return (
      <>
        <h3 className="page-heading">Graphite details</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <FormLabel tooltip="This option controls what functions are available in the Graphite query editor.">
              Version
            </FormLabel>
            <Select
              value={graphiteVersions.find(version => version.value === value.jsonData.graphiteVersion)}
              options={graphiteVersions}
              width={7}
              onChange={this.onChangeHandler('graphiteVersion')}
            />
          </div>
          <div className="gf-form-inline">
            <FormLabel>Type</FormLabel>
            <Select
              options={graphiteTypes}
              value={graphiteTypes.find(type => type.value === value.jsonData.graphiteType)}
              width={7}
              onChange={this.onChangeHandler('graphiteType')}
            />
            <div className="gf-form">
              <Button variant="secondary">
                Help > <i className={showMetricTankHelp ? 'fa fa-caret-down' : 'fa fa-caret-right'} />
              </Button>
            </div>
            {showMetricTankHelp && (
              <div className="grafana-info-box m-t-2">
                <div className="alert-body">
                  <p>
                    There are different types of Graphite compatible backends. Here you can specify the type you are
                    using. If you are using{' '}
                    <a href="https://github.com/grafana/metrictank" className="pointer" target="_blank">
                      Metrictank
                    </a>
                    then select that here. This will enable Metrictank specific features like query processing meta
                    data. Metrictank is a multi-tenant timeseries engine for Graphite and friends.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
}
