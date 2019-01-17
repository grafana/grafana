import React, { PureComponent } from 'react';
import _ from 'lodash';
import Scrollbars from 'react-custom-scrollbars';

interface Props {
  customClassName?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHideDuration?: number;
  autoMaxHeight?: string;
  hideTracksWhenNotNeeded?: boolean;
  scrollTop?: number;
  setScrollTop: (value: React.MouseEvent<HTMLElement>) => void;
  autoHeightMin?: number | string;
}

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
export class CustomScrollbar extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    customClassName: 'custom-scrollbars',
    autoHide: true,
    autoHideTimeout: 200,
    autoHideDuration: 200,
    autoMaxHeight: '100%',
    hideTracksWhenNotNeeded: false,
    scrollTop: 0,
    setScrollTop: () => {},
    autoHeightMin: '0'
  };

  private ref: React.RefObject<Scrollbars>;

  constructor(props: Props) {
    super(props);
    this.ref = React.createRef<Scrollbars>();
  }

  updateScroll() {
    const ref = this.ref.current;

    if (ref && !_.isNil(this.props.scrollTop)) {
      if (this.props.scrollTop > 10000) {
        ref.scrollToBottom();
      } else {
        ref.scrollTop(this.props.scrollTop);
      }
   }
  }

  componentDidMount() {
    this.updateScroll();
  }

  componentDidUpdate() {
    this.updateScroll();
  }

  render() {
    const { customClassName, children, autoMaxHeight } = this.props;

    return (
      <Scrollbars
        ref={this.ref}
        className={customClassName}
        autoHeight={true}
        // These autoHeightMin & autoHeightMax options affect firefox and chrome differently.
        // Before these where set to inhert but that caused problems with cut of legends in firefox
        autoHeightMax={autoMaxHeight}
        renderTrackHorizontal={props => <div {...props} className="track-horizontal" />}
        renderTrackVertical={props => <div {...props} className="track-vertical" />}
        renderThumbHorizontal={props => <div {...props} className="thumb-horizontal" />}
        renderThumbVertical={props => <div {...props} className="thumb-vertical" />}
        renderView={props => <div {...props} className="view" />}
      >
        {children}
      </Scrollbars>
    );
  }
}

export default CustomScrollbar;
