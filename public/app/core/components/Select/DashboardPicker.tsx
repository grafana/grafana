import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Forms } from '@grafana/ui';
import { FormInputSize } from '@grafana/ui/src/components/Forms/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit, DashboardDTO } from 'app/types';

export interface Props {
  onSelected: (dashboard: DashboardDTO) => void;
  currentDashboardId?: SelectableValue<number>;
  size?: FormInputSize;
}

export interface State {
  isLoading: boolean;
}

export class DashboardPicker extends PureComponent<Props, State> {
  debouncedSearch: any;

  static defaultProps = {
    size: 'md',
  };

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
    return backendSrv.search({ type: 'dash-db', query }).then((result: DashboardSearchHit[]) => {
      const dashboards = result.map((item: DashboardSearchHit) => ({
        id: item.id,
        value: item.id,
        label: `${item.folderTitle ? item.folderTitle : 'General'}/${item.title}`,
      }));

      this.setState({ isLoading: false });
      return dashboards;
    });
  };

  render() {
    const { size, onSelected, currentDashboardId } = this.props;
    const { isLoading } = this.state;

    return (
      <Forms.AsyncSelect
        size={size}
        isLoading={isLoading}
        isClearable={true}
        defaultOptions={true}
        loadOptions={this.debouncedSearch}
        onChange={onSelected}
        placeholder="Select dashboard"
        noOptionsMessage={'No dashboards found'}
        value={currentDashboardId}
      />
    );
  }
}
