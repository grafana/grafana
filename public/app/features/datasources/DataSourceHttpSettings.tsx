import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { DataSource } from 'app/types';
import FormSwitch from '../../core/components/FormSwitch/FormSwitch';

interface Props {
  dataSource: DataSource;
  showAccessOption: any;
  tlsAuth: any;
  tlsAuthWithCACert: any;
  tlsCACert: any;
  tlsClientCert: any;
  tlsClientKey: any;
}

interface State {
  basicAuthUser: string;
  basicAuthPassword: string;
  showAccessHelp: boolean;
  url: string;
  access: string;
}

export class DataSourceHttpSettings extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      url: '',
      basicAuthUser: props.dataSource.basicAuthUser,
      basicAuthPassword: props.dataSource.basicAuthPassword,
      showAccessHelp: false,
      access: '',
    };
  }

  onToggleAccessHelp = () => {
    this.setState(prevState => ({
      showAccessHelp: !prevState.showAccessHelp,
    }));
  };

  onUrlChange = event => {
    this.setState({
      url: event.target.value,
    });
  };

  onAccessChange = event => {
    this.setState({
      access: event.target.value,
    });
  };

  onBasicAuthChange = event => {
    console.log(event);
  };

  onWithCredentialsChange = event => {
    console.log(event);
  };

  onTlsAuthChange = event => {
    console.log(event);
  };

  onTlsAuthWithCACertChange = event => {
    console.log(event);
  };

  onTlsSkipVerifyChange = event => {
    console.log(event);
  };

  render() {
    const {
      dataSource,
      showAccessOption,
      tlsAuth,
      tlsAuthWithCACert,
      tlsCACert,
      tlsClientCert,
      tlsClientKey,
    } = this.props;

    const { access, showAccessHelp, basicAuthUser, basicAuthPassword, url } = this.state;

    const accessOptions = [{ key: 'proxy', value: 'Server (Default)' }, { key: 'direct', value: 'Browser' }];

    return (
      <div className="gf-form-group">
        <h3 className="page-heading">HTTP</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form max-width-30">
              <span className="gf-form-label width-10">URL</span>
              <input
                className="gf-form-input"
                type="text"
                value={url}
                onChange={this.onUrlChange}
                placeholder="https://localhost:9090"
              />
            </div>
          </div>
          {showAccessOption && (
            <div className="gf-form-inline">
              <div className="gf-form max-width-30">
                <span className="gf-form-label width-10">Access</span>
                <select className="width-20" value={access} onChange={this.onAccessChange}>
                  {accessOptions.map(option => {
                    return (
                      <option key={option.key} value={option.key}>
                        {option.value}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="gf-form">
                <label className="gf-form-label query-keyword pointer" onClick={this.onToggleAccessHelp}>
                  Help&nbsp;
                  {showAccessHelp ? <i className="fa fa-caret-down" /> : <i className="fa fa-caret-right">&nbsp;</i>}
                </label>
              </div>
            </div>
          )}
        </div>

        {showAccessHelp && (
          <div className="grafana-info-box m-t-2">
            <p>
              Access mode controls how requests to the data source will be handled.
              <strong>
                <i>Server</i>
              </strong>{' '}
              should be the preferred way if nothing else stated.
            </p>
            <div className="alert-title">Server access mode (Default):</div>
            <p>
              All requests will be made from the browser to Grafana backend/server which in turn will forward the
              requests to the data source and by that circumvent possible Cross-Origin Resource Sharing (CORS)
              requirements. The URL needs to be accessible from the grafana backend/server if you select this access
              mode.
            </p>
            <div className="alert-title">Browser access mode:</div>
            <p>
              All requests will be made from the browser directly to the data source and may be subject to Cross-Origin
              Resource Sharing (CORS) requirements. The URL needs to be accessible from the browser if you select this
              access mode.
            </p>
          </div>
        )}
        {access === 'proxy' && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-10">Whitelisted Cookies</span>
            </div>
          </div>
        )}

        <h3 className="page-heading">Auth</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <FormSwitch
              onChange={this.onBasicAuthChange}
              label="Basic auth"
              checked={dataSource.basicAuth}
              labelClass="width-10"
              switchClass="max-width-6"
            />
            <FormSwitch
              label="With credentials"
              checked={dataSource.withCredentials}
              onChange={this.onWithCredentialsChange}
              labelClass="width-10"
              switchClass="max-width-6"
            />
          </div>
          <div className="gf-form-inline">
            {dataSource.jsonData && [
              <FormSwitch
                key="TLS CLient Auth"
                label="TLS CLient Auth"
                checked={dataSource.jsonData.authType === 'tlsAuth'}
                onChange={this.onTlsAuthChange}
                labelClass="width-10"
                switchClass="max-width-6"
              />,
              <FormSwitch
                key="With CA Cert"
                label="With CA Cert"
                checked={dataSource.jsonData.authType === 'tlsAuthWithCACert'}
                onChange={this.onTlsAuthWithCACertChange}
                labelClass="width-10"
                switchClass="max-width-6"
              />,
            ]}
          </div>
        </div>
        <div className="gf-form-inline">
          {dataSource.jsonData && (
            <FormSwitch
              label="Skip TLS Verify"
              checked={dataSource.jsonData.authType === 'tlsSkipVerify'}
              onChange={this.onTlsSkipVerifyChange}
              labelClass="width-10"
              switchClass="max-width-6"
            />
          )}
        </div>

        {dataSource.basicAuth && (
          <div className="gf-form-group">
            <h6>Basic Auth Details</h6>
            <div className="gf-form">
              <span className="gf-form-label width-10">User</span>
              <input className="gf-form-input max-width-21" type="text" value={basicAuthUser} placeholder="User" />
            </div>
            <div className="gf-form">
              <span className="gf-form-label width-10">Password</span>
              <input
                className="gf-form-input max-width-21"
                type="password"
                value={basicAuthPassword}
                placeholder="Password"
              />
            </div>
          </div>
        )}

        {(tlsAuth || tlsAuthWithCACert) &&
          access === 'proxy' && (
            <div className="gf-form-group">
              <div className="gf-form">
                <h6>TLS Auth Details</h6>
              </div>
              {tlsAuthWithCACert && (
                <div>
                  <div className="gf-form-inline">
                    <div className="gf-form gf-form--v-stretch">
                      <label className="gf-form-label width-7">CA Cert</label>
                    </div>
                    {!tlsCACert && (
                      <div className="gf-form gf-form--grow">
                        <textarea
                          rows={7}
                          className="gf-form-input gf-form-textarea"
                          value={tlsCACert}
                          placeholder="Begins with -----BEGIN CERTIFICATE-----"
                        />
                      </div>
                    )}
                    {tlsCACert && (
                      <div className="gf-form">
                        <input type="text" className="gf-form-input max-width-12" value="configured" />
                        <a className="btn btn-secondary gf-form-btn" href="#" onClick={() => {}}>
                          reset
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tlsAuth && (
                <div>
                  <div className="gf-form-inline">
                    <div className="gf-form gf-form--v-stretch">
                      <label className="gf-form-label width-7">Client Cert</label>
                    </div>
                    {!tlsClientCert && (
                      <div className="gf-form gf-form--grow">
                        <textarea
                          rows={7}
                          className="gf-form-input gf-form-textarea"
                          value={tlsClientCert}
                          placeholder="Begins with -----BEGIN CERTIFICATE-----"
                          required
                        />
                      </div>
                    )}
                    {tlsClientCert && (
                      <div className="gf-form">
                        <input type="text" className="gf-form-input max-width-12" value="configured" />
                        <a className="btn btn-secondary gf-form-btn" href="#" onClick={() => {}}>
                          reset
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="gf-form-inline">
                    <div className="gf-form gf-form--v-stretch">
                      <label className="gf-form-label width-7">Client Key</label>
                    </div>
                    {tlsClientKey && (
                      <div className="gf-form gf-form--grow">
                        <textarea
                          rows={7}
                          className="gf-form-input gf-form-textarea"
                          value={tlsClientKey}
                          placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
                        />
                      </div>
                    )}
                    {tlsClientKey && (
                      <div className="gf-form">
                        <input type="text" className="gf-form-input max-width-12" value="configured" />
                        <a className="btn btn-secondary gf-form-btn" href="#" onClick={() => {}}>
                          reset
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    dataSource: state.dataSources.dataSource,
  };
}

export default connect(mapStateToProps)(DataSourceHttpSettings);
