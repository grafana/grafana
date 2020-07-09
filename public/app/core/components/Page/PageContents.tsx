// Libraries
import React, { Component } from 'react';

// Components
import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  removeStyling?: boolean;
  children: React.ReactNode;
}

class PageContents extends Component<Props> {
  render() {
    const { isLoading, removeStyling } = this.props;

    return (
      <div className={`${!removeStyling ? 'page-container page-body' : ''}`}>
        {isLoading ? <PageLoader /> : this.props.children}
      </div>
    );
  }
}

export default PageContents;
