import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import { FormField } from '@grafana/ui';
import { getNavModel } from '../../core/selectors/navModel';
import { LdapUser, StoreState } from '../../types';
import Page from '../../core/components/Page/Page';
import config from '../../core/config';

interface Props {
  navModel: NavModel;
  ldapUser: LdapUser;
}

interface State {
  isLoading: boolean;
}

export class LdapPage extends PureComponent<Props, State> {
  state = {
    isLoading: false,
  };

  search = (event: any) => {
    event.preventDefault();
    console.log('derp');
  };

  render() {
    const { ldapUser, navModel } = this.props;
    const { isLoading } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="grafana-info-box">
            LDAP server connected
            <i className="fa fa-fw fa-check text-success pull-right" />
          </div>
          {config.buildInfo.isEnterprise && (
            <>
              <h4>LDAP Synchronisation</h4>
              <table className="filter-table form-inline">
                <tbody>
                  <tr>
                    <td>Active synchronisation</td>
                    <td>Enabled</td>
                  </tr>
                  <tr>
                    <td>Scheduled</td>
                    <td>Once a week, between Saturday and Sunday</td>
                  </tr>
                  <tr>
                    <td>Next scheduled synchronisation</td>
                    <td />
                  </tr>
                  <tr>
                    <td>Last synchronisation</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </>
          )}
          <h4>User mapping</h4>
          <form onSubmit={this.search} className="gf-form-inline">
            <FormField label="User name" labelWidth={8} inputWidth={30} type="text" />
            <button type="submit" className="btn btn-primary">
              Test LDAP mapping
            </button>
          </form>
          {ldapUser && (
            <>
              <h4>Mapping result</h4>
              <table className="filter-table form-inline">
                <thead>
                  <th colSpan={2}>User information</th>
                  <th>LDAP attribute</th>
                </thead>
                <tbody>
                  {Object.keys(ldapUser).map((key, index) => {
                    return <tr key={`${key}-${index}`}>{key}</tr>;
                  })}
                </tbody>
              </table>
            </>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'ldap'),
  ldapUser: state.ldap.user,
});

export default hot(module)(connect(mapStateToProps)(LdapPage));
