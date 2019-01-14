// Libraries
import React, { Component } from 'react';

// Components
import PageHeader from '../PageHeader/PageHeader';
import PageContents from './PageContents';
import { CustomScrollbar } from '@grafana/ui';

interface Props {
  title?: string;
  children: JSX.Element[] | JSX.Element;
}

class Page extends Component<Props> {
  private bodyClass = 'is-react';
  private body = document.getElementsByTagName('body')[0];
  private footer = document.getElementsByClassName('footer')[0].cloneNode(true);
  private scrollbarElementRef = React.createRef<HTMLDivElement>();
  static Header = PageHeader;
  static Contents = PageContents;


  componentDidMount() {
    this.body.classList.add(this.bodyClass);
    this.copyFooter();
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

  copyFooter = () => {
    const c = this.scrollbarElementRef.current;
    c.append(this.footer);
  }

  render() {
    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'}>
          <div className="page-scrollbar-content" ref={this.scrollbarElementRef}>
            {this.props.children}
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

export default Page;
