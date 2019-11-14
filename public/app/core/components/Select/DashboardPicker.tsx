import React, { PureComponent } from 'react';
import { AsyncSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit, DashboardDTO } from 'app/types';

export interface Props {
  className?: string;
  onSelected: (dashboard: DashboardDTO) => void;
  currentDashboardId: SelectableValue<number>;
}

export interface State {
  isLoading: boolean;
}

export class DashboardPicker extends PureComponent<Props, State> {
  debouncedSearch: any;

  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: false,
    };

    this.debouncedSearch = debounce(this.getDashboards, 300, {
      leading: true,
      trailing: true,
    });
  }

  getDashboards = (query = '') => {
    this.setState({ isLoading: true });
    return getBackendSrv()
      .search({ type: 'dash-db', query })
      .then((result: DashboardSearchHit[]) => {
        const dashboards = result.map((item: DashboardSearchHit) => {
          return {
            id: item.id,
            value: item.id,
            label: `${item.folderTitle ? item.folderTitle : 'General'}/${item.title}`,
          };
        });

        this.setState({ isLoading: false });
        return dashboards;
      });
  };

  render() {
    const { className, onSelected, currentDashboardId } = this.props;
    const { isLoading } = this.state;

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <AsyncSelect
            className={className}
            isLoading={isLoading}
            isClearable={true}
            defaultOptions={true}
            loadOptions={this.debouncedSearch}
            onChange={onSelected}
            placeholder="Select dashboard"
            noOptionsMessage={() => 'No dashboards found'}
            value={currentDashboardId}
          />
        </div>
      </div>
    );
  }
}
