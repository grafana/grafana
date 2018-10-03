import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavModel, Plugin } from 'app/types';
import { addDataSource, loadDataSourceTypes } from './state/actions';
import { updateLocation } from '../../core/actions';
import { getNavModel } from 'app/core/selectors/navModel';

export interface Props {
  navModel: NavModel;
  dataSourceTypes: Plugin[];
  addDataSource: typeof addDataSource;
  loadDataSourceTypes: typeof loadDataSourceTypes;
  updateLocation: typeof updateLocation;
}

class NewDataSourcePage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadDataSourceTypes();
  }

  onDataSourceTypeClicked = type => {
    this.props.addDataSource(type.name, type.value);
  };

  render() {
    const { navModel, dataSourceTypes } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <h3 className="add-data-source-header">Choose data source type</h3>
          <div className="add-data-source-grid">
            {dataSourceTypes.map((type, index) => {
              return (
                <div
                  onClick={() => this.onDataSourceTypeClicked(type)}
                  className="add-data-source-grid-item"
                  key={`${type.id}-${index}`}
                >
                  <img className="add-data-source-grid-item-logo" src={type.info.logos.small} />
                  <span className="add-data-source-grid-item-text">{type.name}</span>
                </div>
              );
            })}
          </div>
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
