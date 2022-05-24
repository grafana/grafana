// Libraries
import { css } from '@emotion/css';
import { cloneDeep, extend } from 'lodash';
import React, { PureComponent } from 'react';

import { PluginMeta, AppPlugin, deprecationWarning } from '@grafana/data';
import { AngularComponent, getAngularLoader, getBackendSrv } from '@grafana/runtime';
import { Button } from '@grafana/ui';

interface Props {
  app: AppPlugin;
}

interface State {
  angularCtrl: AngularComponent | null;
  refresh: number;
}

export class AppConfigCtrlWrapper extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
  //@ts-ignore
  model: PluginMeta;

  // Needed for angular scope
  preUpdateHook = () => Promise.resolve();
  postUpdateHook = () => Promise.resolve();

  constructor(props: Props) {
    super(props);
    this.state = {
      angularCtrl: null,
      refresh: 0,
    };
  }

  componentDidMount() {
    // Force a reload after the first mount -- is there a better way to do this?
    setTimeout(() => {
      this.setState({ refresh: this.state.refresh + 1 });
    }, 5);
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.element || this.state.angularCtrl) {
      return;
    }

    // Set a copy of the meta
    this.model = cloneDeep(this.props.app.meta);

    const loader = getAngularLoader();
    const template = '<plugin-component type="app-config-ctrl"></plugin-component>';
    const scopeProps = {
      ctrl: this,
      // used by angular injectorMonkeyPatch to detect this scenario
      isAppConfigCtrl: true,
    };
    const angularCtrl = loader.load(this.element, scopeProps, template);

    this.setState({ angularCtrl });
  }

  render() {
    const model = this.model;

    const withRightMargin = css({ marginRight: '8px' });

    return (
      <div>
        <div ref={(element) => (this.element = element)} />
        <br />
        <br />
        {model && (
          <div className="gf-form">
            {!model.enabled && (
              <Button variant="primary" onClick={this.enable} className={withRightMargin}>
                Enable
              </Button>
            )}
            {model.enabled && (
              <Button variant="primary" onClick={this.update} className={withRightMargin}>
                Update
              </Button>
            )}
            {model.enabled && (
              <Button variant="destructive" onClick={this.disable} className={withRightMargin}>
                Disable
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  //-----------------------------------------------------------
  // Copied from plugin_edit_ctrl
  //-----------------------------------------------------------

  update = () => {
    const pluginId = this.model.id;

    this.preUpdateHook()
      .then(() => {
        const updateCmd = extend(
          {
            enabled: this.model.enabled,
            pinned: this.model.pinned,
            jsonData: this.model.jsonData,
            secureJsonData: this.model.secureJsonData,
          },
          {}
        );
        return getBackendSrv().post(`/api/plugins/${pluginId}/settings`, updateCmd);
      })
      .then(this.postUpdateHook)
      .then((res) => {
        window.location.href = window.location.href;
      });
  };

  setPreUpdateHook = (callback: () => any) => {
    this.preUpdateHook = callback;
  };

  setPostUpdateHook = (callback: () => any) => {
    this.postUpdateHook = callback;
  };

  // Stub to avoid unknown function in legacy code
  importDashboards = (): Promise<void> => {
    deprecationWarning('AppConfig', 'importDashboards()');
    return Promise.resolve();
  };

  enable = () => {
    this.model.enabled = true;
    this.model.pinned = true;
    this.update();
  };

  disable = () => {
    this.model.enabled = false;
    this.model.pinned = false;
    this.update();
  };
}
