import React, { PureComponent } from 'react';
import _ from 'lodash';
import Scrollbars from 'react-custom-scrollbars';

interface Props {
  customClassName?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHideDuration?: number;
  autoHeightMax?: string;
  hideTracksWhenNotNeeded?: boolean;
  renderTrackHorizontal?: React.FunctionComponent<any>;
  renderTrackVertical?: React.FunctionComponent<any>;
  scrollTop?: number;
  setScrollTop: (event: any) => void;
  autoHeightMin?: number | string;
}

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
export class CustomScrollbar extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    customClassName: 'custom-scrollbars',
    autoHide: false,
    autoHideTimeout: 200,
    autoHideDuration: 200,
    setScrollTop: () => {},
    hideTracksWhenNotNeeded: false,
    autoHeightMin: '0',
    autoHeightMax: '100%',
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
    const {
      customClassName,
      children,
      autoHeightMax,
      autoHeightMin,
      setScrollTop,
      autoHide,
      autoHideTimeout,
      hideTracksWhenNotNeeded,
      renderTrackHorizontal,
      renderTrackVertical,
    } = this.props;

    return (
      <Scrollbars
        ref={this.ref}
        className={customClassName}
        onScroll={setScrollTop}
        autoHeight={true}
        autoHide={autoHide}
        autoHideTimeout={autoHideTimeout}
        hideTracksWhenNotNeeded={hideTracksWhenNotNeeded}
        // These autoHeightMin & autoHeightMax options affect firefox and chrome differently.
        // Before these where set to inhert but that caused problems with cut of legends in firefox
        autoHeightMax={autoHeightMax}
        autoHeightMin={autoHeightMin}
        renderTrackHorizontal={renderTrackHorizontal || (props => <div {...props} className="track-horizontal" />)}
        renderTrackVertical={renderTrackVertical || (props => <div {...props} className="track-vertical" />)}
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
