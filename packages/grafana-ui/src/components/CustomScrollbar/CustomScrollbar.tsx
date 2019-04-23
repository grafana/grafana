import React, { Component } from 'react';
import isNil from 'lodash/isNil';
import classNames from 'classnames';
import Scrollbars from 'react-custom-scrollbars';
import { cx, css } from 'emotion';

interface Props {
  className?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHideDuration?: number;
  autoHeightMax?: string;
  hideTracksWhenNotNeeded?: boolean;
  hideHorizontalTrack?: boolean;
  hideVerticalTrack?: boolean;
  scrollTop?: number;
  setScrollTop: (event: any) => void;
  autoHeightMin?: number | string;
  updateAfterMountMs?: number;
}

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
export class CustomScrollbar extends Component<Props> {
  static defaultProps: Partial<Props> = {
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

    if (ref && !isNil(this.props.scrollTop)) {
      ref.scrollTop(this.props.scrollTop);
    }
  }

  componentDidMount() {
    this.updateScroll();

    // this logic is to make scrollbar visible when content is added body after mount
    if (this.props.updateAfterMountMs) {
      setTimeout(() => this.updateAfterMount(), this.props.updateAfterMountMs);
    }
  }

  updateAfterMount() {
    if (this.ref && this.ref.current) {
      const scrollbar = this.ref.current as any;
      if (scrollbar.update) {
        scrollbar.update();
      }
    }
  }

  componentDidUpdate() {
    this.updateScroll();
  }

  render() {
    const {
      className,
      children,
      autoHeightMax,
      autoHeightMin,
      setScrollTop,
      autoHide,
      autoHideTimeout,
      hideTracksWhenNotNeeded,
      hideHorizontalTrack,
      hideVerticalTrack,
    } = this.props;

    return (
      <Scrollbars
        ref={this.ref}
        className={classNames('custom-scrollbar', className)}
        onScroll={setScrollTop}
        autoHeight={true}
        autoHide={autoHide}
        autoHideTimeout={autoHideTimeout}
        hideTracksWhenNotNeeded={hideTracksWhenNotNeeded}
        // These autoHeightMin & autoHeightMax options affect firefox and chrome differently.
        // Before these where set to inhert but that caused problems with cut of legends in firefox
        autoHeightMax={autoHeightMax}
        autoHeightMin={autoHeightMin}
        renderTrackHorizontal={props => (
          <div
            {...props}
            className={cx(
              css`
                visibility: ${hideHorizontalTrack ? 'none' : 'visible'};
              `,
              'track-horizontal'
            )}
          />
        )}
        renderTrackVertical={props => (
          <div
            {...props}
            className={cx(
              css`
                visibility: ${hideVerticalTrack ? 'none' : 'visible'};
              `,
              'track-vertical'
            )}
          />
        )}
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
