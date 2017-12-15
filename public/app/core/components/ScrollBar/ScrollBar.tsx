import React from 'react';
import PerfectScrollbar from 'perfect-scrollbar';

export interface Props {
  children: any;
  className: string;
}

export default class ScrollBar extends React.Component<Props, any> {

  private container: any;
  private ps: PerfectScrollbar;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.ps = new PerfectScrollbar(this.container);
  }

  componentDidUpdate() {
    this.ps.update();
  }

  componentWillUnmount() {
    this.ps.destroy();
  }

  // methods can be invoked by outside
  setScrollTop(top) {
    if (this.container) {
      this.container.scrollTop = top;
      this.ps.update();

      return true;
    }
    return false;
  }

  setScrollLeft(left) {
    if (this.container) {
      this.container.scrollLeft = left;
      this.ps.update();

      return true;
    }
    return false;
  }

  handleRef = ref => {
    this.container = ref;
  };

  render() {
    return (
      <div className={this.props.className} ref={this.handleRef}>
        {this.props.children}
      </div>
    );
  }
}
