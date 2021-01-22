import React, { Component } from 'react';
import isNil from 'lodash/isNil';
import classNames from 'classnames';
import { css } from 'emotion';
import Scrollbars from 'react-custom-scrollbars';

const getStyles = (page?: boolean) => {
  return {
    customScrollbar: css`
      display: flex;
      flex-grow: 1;
      &:hover {
        opacity: 0.8;
        transition: opacity 0.3s ease-in-out;
      }
    `,
    trackVertical: css`
      border-radius: 3px;
      width: 8px !important;
      right: ${page ? 0 : 2}px;
      bottom: 2px;
    `,
    trackHorizontal: css`
      border-radius: 3px;
      height: 8px !important;
      right: 2px;
      bottom: 2px;
      left: 2px;
    `,
    thumbVertical: css`
      @include gradient-vertical($scrollbarBackground, $scrollbarBackground2);
      border-radius: 6px;
      opacity: 0;
      &:hover {
        opacity: 0.8;
        transition: opacity 0.3s ease-in-out;
      }
    `,
    thumbHorizontal: css`
      @include gradient-horizontal($scrollbarBackground, $scrollbarBackground2);
      border-radius: 6px;
      opacity: 0;
      &:hover {
        opacity: 0.8;
        transition: opacity 0.3s ease-in-out;
      }
    `,
    view: css`
      display: flex;
      flex-grow: 1;
      flex-direction: column;
    `,
  };
};

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
  page?: boolean;
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

  renderTrack = (styles: any, hideTrack: boolean | undefined, passedProps: any) => {
    if (passedProps.style && hideTrack) {
      passedProps.style.display = 'none';
    }

    return <div {...passedProps} className={styles.trackVertical | styles.trackHorizontal} />;
  };

  // renderThumb = (thumb: styles.thumbVertical | styles.thumbHorizontal, passedProps: any) => {
  //   return <div {...passedProps} className={thumb} />;
  // };

  renderTrackHorizontal = (passedProps: any, styles: any) => {
    return this.renderTrack(styles.trackHorizontal, this.props.hideHorizontalTrack, passedProps);
  };

  renderTrackVertical = (passedProps: any, styles: any) => {
    return this.renderTrack(styles.trackVertical, this.props.hideVerticalTrack, passedProps);
  };

  renderThumbHorizontal = (passedProps: any, styles: any) => {
    return <div {...passedProps} className={styles.thumbHorizontal} />;
  };

  renderThumbVertical = (passedProps: any, styles: any) => {
    return <div {...passedProps} className={styles.thumbVertical} />;
  };

  renderView = (passedProps: any, styles: any) => {
    return <div {...passedProps} className={styles.view} />;
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
    const styles = getStyles(this.props.page);

    return (
      <Scrollbars
        ref={this.ref}
        className={classNames(styles.customScrollbar, className)}
        onScroll={setScrollTop}
        autoHeight={true}
        autoHide={autoHide}
        autoHideTimeout={autoHideTimeout}
        hideTracksWhenNotNeeded={hideTracksWhenNotNeeded}
        // These autoHeightMin & autoHeightMax options affect firefox and chrome differently.
        // Before these where set to inherit but that caused problems with cut of legends in firefox
        autoHeightMax={autoHeightMax}
        autoHeightMin={autoHeightMin}
        renderTrackHorizontal={(passedProps: any) => this.renderTrackHorizontal(passedProps, styles)}
        renderTrackVertical={(passedProps: any) => this.renderTrackVertical(passedProps, styles)}
        renderThumbHorizontal={(passedProps: any) => this.renderThumbHorizontal(passedProps, styles)}
        renderThumbVertical={(passedProps: any) => this.renderThumbHorizontal(passedProps, styles)}
        renderView={(passedProps: any) => this.renderView(passedProps, styles)}
      >
        {children}
      </Scrollbars>
    );
  }
}

export default CustomScrollbar;
