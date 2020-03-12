import React, { PureComponent } from 'react';
import { DataSourceHttpSettings, FormLabel, Button, Select } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, onUpdateDatasourceJsonDataOptionSelect } from '@grafana/data';
import { GraphiteOptions, GraphiteType } from '../types';
import styles from './ConfigEditor.styles';

const graphiteVersions = [
  { label: '0.9.x', value: '0.9' },
  { label: '1.0.x', value: '1.0' },
  { label: '1.1.x', value: '1.1' },
];

const graphiteTypes = Object.entries(GraphiteType).map(([label, value]) => ({
  label,
  value,
}));

export type Props = DataSourcePluginOptionsEditorProps<GraphiteOptions>;

interface State {
  showMetricTankHelp: boolean;
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      showMetricTankHelp: false,
    };
  }

  render() {
    const { options, onOptionsChange } = this.props;
    const { showMetricTankHelp } = this.state;

    const currentVersion =
      graphiteVersions.find(item => item.value === options.jsonData.graphiteVersion) ?? graphiteVersions[2];

    return (
      <>
        <DataSourceHttpSettings
          defaultUrl="http://localhost:8080"
          dataSourceConfig={options}
          onChange={onOptionsChange}
        />
        <h3 className="page-heading">Graphite details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel tooltip="This option controls what functions are available in the Graphite query editor.">
                Version
              </FormLabel>
              <Select
                value={currentVersion}
                options={graphiteVersions}
                width={8}
                onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteVersion')}
              />
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel>Type</FormLabel>
              <Select
                options={graphiteTypes}
                value={graphiteTypes.find(type => type.value === options.jsonData.graphiteType)}
                width={8}
                onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteType')}
              />

              <div className={styles.helpbtn}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    this.setState((prevState: State) => ({ showMetricTankHelp: !prevState.showMetricTankHelp }))
                  }
                >
                  Help <i className={showMetricTankHelp ? 'fa fa-caret-down' : 'fa fa-caret-right'} />
                </Button>
              </div>
            </div>
          </div>
          {showMetricTankHelp && (
            <div className="grafana-info-box m-t-2">
              <div className="alert-body">
                <p>
                  There are different types of Graphite compatible backends. Here you can specify the type you are
                  using. If you are using{' '}
                  <a href="https://github.com/grafana/metrictank" className="pointer" target="_blank">
                    Metrictank
                  </a>{' '}
                  then select that here. This will enable Metrictank specific features like query processing meta data.
                  Metrictank is a multi-tenant timeseries engine for Graphite and friends.
                </p>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }
}
