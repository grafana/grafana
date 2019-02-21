// Libraries
import React, { Component } from 'react';
import config from 'app/core/config';
import { NavModel } from 'app/types';
import { getTitleFromNavModel } from 'app/core/selectors/navModel';

// Components
import PageHeader from '../PageHeader/PageHeader';
import Footer from '../Footer/Footer';
import PageContents from './PageContents';
import { CustomScrollbar } from '@grafana/ui';
import { isEqual } from 'lodash';

interface Props {
  children: JSX.Element[] | JSX.Element;
  navModel: NavModel;
}

class Page extends Component<Props> {
  static Header = PageHeader;
  static Contents = PageContents;

  componentDidMount() {
    this.updateTitle();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.navModel, this.props.navModel)) {
      this.updateTitle();
    }
  }

  updateTitle = () => {
    const title = this.getPageTitle;
    document.title = title ? title + ' - Grafana' : 'Grafana';
  };

  get getPageTitle() {
    const { navModel } = this.props;
    if (navModel) {
      return getTitleFromNavModel(navModel) || undefined;
    }
    return undefined;
  }

  render() {
    const { navModel } = this.props;
    const { buildInfo } = config;
    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'} className="custom-scrollbar--page">
          <div className="page-scrollbar-content">
            <PageHeader model={navModel} />
            {this.props.children}
            <Footer
              appName="Grafana"
              buildCommit={buildInfo.commit}
              buildVersion={buildInfo.version}
              newGrafanaVersion={buildInfo.latestVersion}
              newGrafanaVersionExists={buildInfo.hasUpdate}
            />
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

export default Page;
