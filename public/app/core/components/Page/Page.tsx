// Libraries
import React, { Component } from 'react';
import config from 'app/core/config';

// Components
import PageHeader from '../PageHeader/PageHeader';
import Footer from '../Footer/Footer';
import PageContents from './PageContents';
import { CustomScrollbar } from '@grafana/ui';


interface Props {
  title?: string;
  children: JSX.Element[] | JSX.Element;
}

class Page extends Component<Props> {
  private bodyClass = 'is-react';
  private body = document.getElementsByTagName('body')[0];
  static Header = PageHeader;
  static Contents = PageContents;

  componentDidMount() {
    this.body.classList.add(this.bodyClass);
    this.updateTitle();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.title !== this.props.title) {
      this.updateTitle();
    }
  }

  componentWillUnmount() {
    this.body.classList.remove(this.bodyClass);
  }

  updateTitle = () => {
    const { title } = this.props;
    document.title = title ? title + ' - Grafana' : 'Grafana';
  }

  render() {
    const { buildInfo } = config;
    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'}>
          <div className="page-scrollbar-content">
            {this.props.children}
            <Footer
              appName="Grafana"
              buildCommit={buildInfo.commit}
              buildVersion={buildInfo.version}
              newGrafanaVersion={buildInfo.latestVersion}
              newGrafanaVersionExists={buildInfo.hasUpdate} />
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

export default Page;
