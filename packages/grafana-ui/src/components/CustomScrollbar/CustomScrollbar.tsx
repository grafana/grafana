import React, { Component } from 'react';
import isNil from 'lodash/isNil';
import classNames from 'classnames';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Themeable } from '../../types/theme';
import { stylesFactory } from '../../themes';
import { withTheme } from '../../themes/index';
import Scrollbars from 'react-custom-scrollbars';

interface Props extends Themeable {
  theme: GrafanaTheme;
  className?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHideDuration?: number;
  autoHeightMax?: string;
  hideTracksWhenNotNeeded?: boolean;
  hideHorizontalTrack?: boolean;
  hideVerticalTrack?: boolean;
  scrollTop?: number;
  setScrollTop?: (event: any) => void;
  autoHeightMin?: number | string;
  updateAfterMountMs?: number;
  isPageScrollbar?: boolean;
}

interface StylesInterface {
  customScrollbar: string;
  trackVertical: string;
  trackHorizontal: string;
  thumbVertical: string;
  thumbHorizontal: string;
  view: string;
}

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
export class UnthemedCustomScrollbar extends Component<Props> {
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

  renderTrack = (style: string, hideTrack: boolean | undefined, passedProps: any) => {
    if (passedProps.style && hideTrack) {
      passedProps.style.display = 'none';
    }

    return <div {...passedProps} className={style} />;
  };

  renderTrackHorizontal = (passedProps: any, styles: StylesInterface) => {
    return this.renderTrack(styles.trackHorizontal, this.props.hideHorizontalTrack, passedProps);
  };

  renderTrackVertical = (passedProps: any, styles: StylesInterface) => {
    return this.renderTrack(styles.trackVertical, this.props.hideVerticalTrack, passedProps);
  };

  renderThumbHorizontal = (passedProps: any, styles: StylesInterface) => {
    return <div {...passedProps} className={styles.thumbHorizontal} />;
  };

  renderThumbVertical = (passedProps: any, styles: StylesInterface) => {
    return <div {...passedProps} className={styles.thumbVertical} />;
  };

  renderView = (passedProps: any, styles: StylesInterface) => {
    return <div {...passedProps} className={styles.view} />;
  };
  render() {
    const {
      theme,
      className,
      children,
      autoHeightMax,
      autoHeightMin,
      setScrollTop,
      autoHide,
      autoHideTimeout,
      hideTracksWhenNotNeeded,
      isPageScrollbar,
    } = this.props;
    const styles = getStyles(theme, isPageScrollbar);

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

export const CustomScrollbar = withTheme(UnthemedCustomScrollbar);
CustomScrollbar.displayName = 'CustomScrollbar';

const getStyles = stylesFactory(
  (theme: GrafanaTheme, isPageScrollbar?: boolean): StylesInterface => {
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
        right: ${isPageScrollbar ? 0 : 2}px;
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
        linear-gradient(#404357, ${theme.palette.dark10});
        border-radius: 6px;
        opacity: 0;
        &:hover {
          opacity: 0.8;
          transition: opacity 0.3s ease-in-out;
        }
      `,
      thumbHorizontal: css`
        linear-gradient(#404357, ${theme.palette.dark10});
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
  }
);
