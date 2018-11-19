import React, { PureComponent } from 'react';

import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { EditorTabBody } from './EditorTabBody';
import { DataSourcePicker } from './DataSourcePicker';

import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import './../../panel/metrics_tab';
import config from 'app/core/config';

// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DataSourceSelectItem } from 'app/types';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

interface State {
  currentDatasource: DataSourceSelectItem;
}

export class QueriesTab extends PureComponent<Props, State> {
  element: any;
  component: AngularComponent;
  datasources: DataSourceSelectItem[] = getDatasourceSrv().getMetricSources();

  constructor(props) {
    super(props);
    const { panel } = props;

    this.state = {
      currentDatasource: this.datasources.find(datasource => datasource.value === panel.datasource),
    };
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const { panel, dashboard } = this.props;

    const loader = getAngularLoader();
    const template = '<metrics-tab />';
    const scopeProps = {
      ctrl: {
        panel: panel,
        dashboard: dashboard,
        refresh: () => panel.refresh(),
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  onChangeDataSource = datasource => {
    const { panel } = this.props;
    const { currentDatasource } = this.state;
    // switching to mixed
    if (datasource.meta.mixed) {
      panel.targets.forEach(target => {
        target.datasource = panel.datasource;
        if (!target.datasource) {
          target.datasource = config.defaultDatasource;
        }
      });
    } else if (currentDatasource && currentDatasource.meta.mixed) {
      panel.targets.forEach(target => {
        delete target.datasource;
      });
    }

    panel.datasource = datasource.value;
    panel.refresh();

    this.setState(prevState => ({
      ...prevState,
      currentDatasource: datasource,
    }));
    // this.component.digest();
  };

  render() {
    const { currentDatasource } = this.state;
    const dsInformation = {
      title: currentDatasource.name,
      imgSrc: currentDatasource.meta.info.logos.small,
      render: closeOpenView => (
        <DataSourcePicker
          datasources={this.datasources}
          onChangeDataSource={ds => {
            closeOpenView();
            this.onChangeDataSource(ds);
          }}
        />
      ),
    };

    const queryInspector = {
      title: 'Query Inspector',
      render: () => <h2>hello</h2>,
    };

    const dsHelp = {
      title: '',
      icon: 'fa fa-question',
      render: () => <h2>hello</h2>,
    };

    return (
      <EditorTabBody main={dsInformation} toolbarItems={[queryInspector, dsHelp]}>
        <div ref={element => (this.element = element)} style={{ width: '100%' }} />
      </EditorTabBody>
    );
  }
}
