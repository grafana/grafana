// Libraries
import React, { Component } from 'react';

// Components
import PageHeader from '../PageHeader/PageHeader';
import PageContents from './PageContents';

interface Props {
  title: string;
  children: JSX.Element[] | JSX.Element;
}

class Page extends Component<Props> {
  static Header = PageHeader;
  static Contents = PageContents;

  render() {
    return (
      <div>
        {this.props.children}
      </div>
    );
  }
}

export default Page;
