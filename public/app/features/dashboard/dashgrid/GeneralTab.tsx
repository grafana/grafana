import React, { PureComponent } from 'react';

import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { EditorTabBody } from './EditorTabBody';

import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class GeneralTab extends PureComponent<Props> {
  element: any;
  component: AngularComponent;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const { panel, dashboard } = this.props;

    const loader = getAngularLoader();
    const template = '<panel-general-tab />';
    const scopeProps = {
      ctrl: {
        panel: panel,
        dashboard: dashboard,
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  render() {
    const currentDataSource = {
      title: 'ProductionDB',
      imgSrc: 'public/app/plugins/datasource/prometheus/img/prometheus_logo.svg',
      render: () => <h2>hello</h2>,
    };

    return (
      <EditorTabBody main={currentDataSource} toolbarItems={[]}>
        <div ref={element => (this.element = element)} style={{ width: '100%' }} />
      </EditorTabBody>
    );
  }
}
