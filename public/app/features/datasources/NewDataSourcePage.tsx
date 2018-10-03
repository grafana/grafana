import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Select from 'react-select';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { DataSourceType, NavModel } from 'app/types';
import { addDataSource, loadDataSourceTypes } from './state/actions';
import { updateLocation } from '../../core/actions';
import { getNavModel } from 'app/core/selectors/navModel';

export interface Props {
  navModel: NavModel;
  dataSourceTypes: DataSourceType[];
  addDataSource: typeof addDataSource;
  loadDataSourceTypes: typeof loadDataSourceTypes;
  updateLocation: typeof updateLocation;
}

export interface State {
  name: string;
  type: { value: string; label: string };
}

class NewDataSourcePage extends PureComponent<Props, State> {
  state = {
    name: '',
    type: null,
  };

  componentDidMount() {
    this.props.loadDataSourceTypes();
  }

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

  submitForm = event => {
    event.preventDefault();

    if (!this.isFieldsEmpty()) {
      this.props.addDataSource(this.state.name, this.state.type.value);
    }
  };

  goBack = () => {
    this.props.updateLocation({ path: '/datasources' });
  };

  isFieldsEmpty = () => {
    const { name, type } = this.state;

    if (name === '' && !type) {
      return true;
    } else if (name !== '' && !type) {
      return true;
    } else {
      return !!(name === '' && type);
    }
  };

  render() {
    const { navModel, dataSourceTypes } = this.props;
    const { name, type } = this.state;

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
                valueKey="type"
                labelKey="name"
                options={dataSourceTypes}
                value={type}
                onChange={this.onTypeChanged}
                autoSize={true}
                className="width-23"
              />
            </div>
            <div className="gf-form-button-row">
              <button type="submit" className="btn btn-success width-7" disabled={this.isFieldsEmpty()}>
                <i className="fa fa-save" />
                {` Create`}
              </button>
              <button className="btn btn-danger" onClick={this.goBack}>
                Cancel
              </button>
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
    dataSourceTypes: state.dataSources.dataSourceTypes,
  };
}

const mapDispatchToProps = {
  addDataSource,
  loadDataSourceTypes,
  updateLocation,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NewDataSourcePage));
