import React, { PureComponent } from 'react';
import { AsyncSelect } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { Organization } from 'app/types';
import { SelectableValue } from '@grafana/data';

export type OrgSelectItem = SelectableValue<Organization>;

export interface Props {
  onSelected: (org: OrgSelectItem) => void;
  className?: string;
}

export interface State {
  isLoading: boolean;
}

export class OrgPicker extends PureComponent<Props, State> {
  orgs: Organization[] = [];

  state: State = {
    isLoading: false,
  };

  async loadOrgs() {
    this.setState({ isLoading: true });
    const orgs = await getBackendSrv().get('/api/orgs');
    this.orgs = orgs;
    this.setState({ isLoading: false });
    return orgs;
  }

  getOrgOptions = async (query: string): Promise<OrgSelectItem[]> => {
    if (!this.orgs?.length) {
      await this.loadOrgs();
    }
    return this.orgs.map(
      (org: Organization): OrgSelectItem => ({
        value: { id: org.id, name: org.name },
        label: org.name,
      })
    );
  };

  render() {
    const { className, onSelected } = this.props;
    const { isLoading } = this.state;

    return (
      <AsyncSelect
        className={className}
        isLoading={isLoading}
        defaultOptions={true}
        isSearchable={false}
        loadOptions={this.getOrgOptions}
        onChange={onSelected}
        placeholder="Select organization"
        noOptionsMessage="No organizations found"
      />
    );
  }
}
