import React, { Component } from 'react';
import _ from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { Organization } from 'app/types';

export interface OrgOption {
  id: number;
  value: string;
  label: string;
}

export interface Props {
  onSelected: (org: OrgOption) => void;
  className?: string;
}

export interface State {
  isLoading: boolean;
}

export class OrganizationPicker extends Component<Props, State> {
  debouncedSearch: any;

  constructor(props: Props) {
    super(props);
    this.state = { isLoading: false };
    this.search = this.search.bind(this);

    this.debouncedSearch = _.debounce(this.search, 300, {
      leading: true,
      trailing: true,
    });
  }

  async search(query?: string) {
    this.setState({ isLoading: true });

    if (_.isNil(query)) {
      query = '';
    }

    return await getBackendSrv()
      .get('/api/orgs', { query: query })
      .then((result: Organization[]) => {
        const organizations = result.map((org: Organization) => {
          return {
            id: org.id,
            value: org.name,
            label: org.name,
          };
        });

        this.setState({ isLoading: false });
        return organizations;
      });
  }

  render() {
    const { onSelected, className } = this.props;
    const { isLoading } = this.state;
    return (
      <div className="user-picker">
        <AsyncSelect
          inputId="org-picker"
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.debouncedSearch}
          onChange={onSelected}
          className={className}
          placeholder="Select an organization"
          noOptionsMessage={() => 'No organizations found'}
        />
      </div>
    );
  }
}
