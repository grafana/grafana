import React, { PureComponent } from 'react';
import { DataSourceSettings } from '@grafana/data';
import { e2e } from '@grafana/e2e';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types/';

export interface Props {
  dataSource: DataSourceSettings;
  deleteDataSource: (id: number) => void;
}

interface State {
  deleteConfirmOpen: boolean;
}

export class DataSourcesListItem extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      deleteConfirmOpen: false,
    };
  }

  toggleDeleteOpen = () => {
    this.setState({
      deleteConfirmOpen: !this.state.deleteConfirmOpen,
    });
  };

  onDelete = () => {
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete',
      text: 'Are you sure you want to delete this data source?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        this.props.deleteDataSource(this.props.dataSource.id);
      },
    });
  };

  render() {
    const { dataSource } = this.props;

    return (
      <div className="configuration-card-item">
        <img className="configuration-card-item-logo" src={dataSource.typeLogoUrl} />
        <div className="configuration-card-item-text-wrapper">
          <span className="configuration-card-item-text">{dataSource.name}</span>
          {dataSource.type && <span className="configuration-card-item-desc">{dataSource.type}</span>}
        </div>
        <div className="configuration-card-item-url">
          <span className="configuration-card-item-text">{dataSource.url}</span>
        </div>
        <div className="configuration-card-item-actions">
          {!this.state.deleteConfirmOpen ? (
            <>
              <a
                className="configuration-card-item-link gicon gicon-explore"
                aria-label={e2e.pages.DataSources.selectors.dataSources(dataSource.name)}
                href={`explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22${dataSource.name}%22,%7B%7D,%7B%22mode%22:%22Metrics%22%7D,%7B%22ui%22:%5Btrue,true,true,%22none%22%5D%7D%5D`}
              />
              {/* <a
                className="configuration-card-item-link gicon gicon-dashboard"
                href={`/datasources/edit/${dataSource.id}/dashboards`}
              /> */}
              <a className="configuration-card-item-link fa fa-trash" onClick={this.toggleDeleteOpen} />
              <a className="btn btn-primary" href={`datasources/edit/${dataSource.id}`}>
                Configure
              </a>
            </>
          ) : null}
          {this.state.deleteConfirmOpen ? (
            <div className="configuration-card-item-configbtn">
              <a className="btn btn-danger" onClick={this.onDelete}>
                Confirm delete
              </a>
              <a className="btn" onClick={this.toggleDeleteOpen}>
                Cancel
              </a>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

export default DataSourcesListItem;
