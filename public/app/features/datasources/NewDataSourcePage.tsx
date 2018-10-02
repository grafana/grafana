import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Select from 'react-select';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavModel } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';

export interface Props {
  navModel: NavModel;
}

export interface State {
  name: string;
  type: string;
  dataSourceOptions: Array<{ value: string; label: string }>;
}

class NewDataSourcePage extends PureComponent<Props, State> {
  state = {
    name: '',
    type: '',
    dataSourceOptions: [
      { value: 'prometheus', label: 'Prometheus' },
      { value: 'graphite', label: 'Graphite' },
      { value: 'mysql', label: 'MySql' },
      { value: 'influxdb', label: 'InfluxDB' },
    ],
  };

  onChangeName = event => {
    this.setState({
      name: event.target.value,
    });
  };

  onTypeChanged = type => {
    this.setState({
      type: type,
    });
  };

  submitForm = () => {
    if (!this.isFieldsEmpty()) {
      // post
    }
  };

  isFieldsEmpty = () => {
    const { name, type } = this.state;

    if (name === '' && type === '') {
      return true;
    } else if (name !== '' && type === '') {
      return true;
    } else {
      return name === '' && type !== '';
    }
  };

  render() {
    const { navModel } = this.props;
    const { dataSourceOptions, name, type } = this.state;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <h3 className="page-sub-heading">New Data source</h3>
          <form onSubmit={this.submitForm}>
            <div className="gf-form max-width-30">
              <span className="gf-form-label width-7">Name</span>
              <input
                className="gf-form-input max-width-23"
                type="text"
                value={name}
                onChange={this.onChangeName}
                placeholder="Name"
              />
            </div>
            <div className="gf-form max-width-30">
              <span className="gf-form-label width-7">Type</span>
              <Select
                options={dataSourceOptions}
                value={type}
                onChange={this.onTypeChanged}
                autoSize={true}
                className="width-23"
              />
            </div>
            <div className="gf-form-button-row">
              <button type="submit" className="btn btn-success" disabled={this.isFieldsEmpty()}>
                Create
              </button>
              <button className="btn btn-danger">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'datasources'),
  };
}

export default hot(module)(connect(mapStateToProps)(NewDataSourcePage));
