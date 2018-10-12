import React, { PureComponent } from 'react';

interface Props {
  access: any;
  basicAuth: any;
  showAccessOption: any;
  tlsAuth: any;
  tlsAuthWithCACert: any;
  tlsCACert: any;
  tlsClientCert: any;
  tlsClientKey: any;
  url: any;
}

interface State {
  basicAuthUser: string;
  basicAuthPassword: string;
  showAccessHelp: boolean;
}

export default class DataSourceHttpSettings extends PureComponent<Props, State> {
  state = {
    basicAuthUser: '',
    basicAuthPassword: '',
    showAccessHelp: false,
  };

  onToggleAccessHelp = () => {};

  render() {
    const {
      access,
      basicAuth,
      showAccessOption,
      tlsAuth,
      tlsAuthWithCACert,
      tlsCACert,
      tlsClientCert,
      tlsClientKey,
      url,
    } = this.props;

    const { showAccessHelp, basicAuthUser, basicAuthPassword } = this.state;

    // const accessOptions = [{key: 'proxy', value: 'Server (Default)'}, { key: 'direct', value: 'Browser'}];

    return (
      <div className="gf-form-group">
        <h3 className="page-heading">HTTP</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form max-width-30">
              <span className="gf-form-label width-10">URL</span>
              <input className="gf-form-input" type="text" value={url} placeholder="https://localhost:9090" />
            </div>
          </div>
          {showAccessOption && (
            <div className="gf-form-inline">
              <div className="gf-form max-width-30">
                <span className="gf-form-label width-10">Access</span>
                <div className="gf-form-select-wrapper max-width-24" />
              </div>
              <div className="gf-form">
                <label className="gf-form-label query-keyword pointer" onClick={this.onToggleAccessHelp}>
                  Help&nbsp;
                  {showAccessHelp && <i className="fa fa-caret-down" />}
                  {!showAccessHelp && <i className="fa fa-caret-right">&nbsp;</i>}
                </label>
              </div>
            </div>
          )}

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
                All requests will be made from the browser directly to the data source and may be subject to
                Cross-Origin Resource Sharing (CORS) requirements. The URL needs to be accessible from the browser if
                you select this access mode.
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
            <div className="gf-form-inline" />
            <div className="gf-form-inline" />
            <div className="gf-form-inline" />
          </div>

          {basicAuth && (
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
      </div>
    );
  }
}
