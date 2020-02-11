// Libraries
import React, { Component } from 'react';

// Components
import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: JSX.Element[] | JSX.Element;
}

class PageContents extends Component<Props> {
  render() {
    const { isLoading } = this.props;

    return <div className="page-container page-body">{isLoading ? <PageLoader /> : this.props.children}</div>;
  }
}

export default PageContents;
