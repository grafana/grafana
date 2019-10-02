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
    const { scrollTop } = this.props;

    if (ref && !isNil(scrollTop)) {
      ref.scrollTop(scrollTop);
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

  renderTrack = (track: 'track-vertical' | 'track-horizontal', hideTrack: boolean | undefined, passedProps: any) => {
    return (
      <div
        {...passedProps}
        className={cx(
          css`
            visibility: ${hideTrack ? 'hidden' : 'visible'};
          `,
          track
        )}
      />
    );
  };

  renderThumb = (thumb: 'thumb-horizontal' | 'thumb-vertical', passedProps: any) => {
    return <div {...passedProps} className={thumb} />;
  };

  renderTrackHorizontal = (passedProps: any) => {
    return this.renderTrack('track-horizontal', this.props.hideHorizontalTrack, passedProps);
  };

  renderTrackVertical = (passedProps: any) => {
    return this.renderTrack('track-vertical', this.props.hideVerticalTrack, passedProps);
  };

  renderThumbHorizontal = (passedProps: any) => {
    return this.renderThumb('thumb-horizontal', passedProps);
  };

  renderThumbVertical = (passedProps: any) => {
    return this.renderThumb('thumb-vertical', passedProps);
  };

  renderView = (passedProps: any) => {
    return <div {...passedProps} className="view" />;
  };

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
        renderTrackHorizontal={this.renderTrackHorizontal}
        renderTrackVertical={this.renderTrackVertical}
        renderThumbHorizontal={this.renderThumbHorizontal}
        renderThumbVertical={this.renderThumbVertical}
        renderView={this.renderView}
      >
        {children}
      </Scrollbars>
    );
  }
}

export default CustomScrollbar;
