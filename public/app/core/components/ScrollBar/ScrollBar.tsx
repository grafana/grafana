import React from 'react';
import baron from 'baron';

export interface Props {
  children: any;
  className: string;
}

export default class ScrollBar extends React.Component<Props, any> {
  private container: any;
  private scrollbar: baron;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.scrollbar = baron({
      root: this.container.parentElement,
      scroller: this.container,
      bar: '.baron__bar',
      barOnCls: '_scrollbar',
      scrollingCls: '_scrolling',
      track: '.baron__track',
    });
  }

  componentDidUpdate() {
    this.scrollbar.update();
  }

  componentWillUnmount() {
    this.scrollbar.dispose();
  }

  // methods can be invoked by outside
  setScrollTop(top) {
    if (this.container) {
      this.container.scrollTop = top;
      this.scrollbar.update();

      return true;
    }
    return false;
  }

  setScrollLeft(left) {
    if (this.container) {
      this.container.scrollLeft = left;
      this.scrollbar.update();

      return true;
    }
    return false;
  }

  update() {
    this.scrollbar.update();
  }

  handleRef = ref => {
    this.container = ref;
  };

  render() {
    return (
      <div className="baron baron__root baron__clipper">
        <div className={this.props.className + ' baron__scroller'} ref={this.handleRef}>
          {this.props.children}
        </div>

        <div className="baron__track">
          <div className="baron__bar" />
        </div>
      </div>
    );
  }
}
