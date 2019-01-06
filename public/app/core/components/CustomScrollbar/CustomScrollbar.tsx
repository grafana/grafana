import React, { PureComponent } from 'react';
import Scrollbars, { ScrollbarProps } from 'react-custom-scrollbars';

interface Props extends ScrollbarProps {
  customClassName?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHideDuration?: number;
  hideTracksWhenNotNeeded?: boolean;
}

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
class CustomScrollbar extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    customClassName: 'custom-scrollbars',
    autoHide: true,
    autoHideTimeout: 200,
    autoHideDuration: 200,
    hideTracksWhenNotNeeded: false,
  };

  render() {
    const { customClassName, children, ...scrollProps } = this.props;

    return (
      <Scrollbars
        className={customClassName}
        autoHeight={true}
        autoHeightMin={'inherit'}
        autoHeightMax={'inherit'}
        onScroll={() => {console.log('scrolling');}}
        renderTrackHorizontal={props => <div {...props} className="track-horizontal" />}
        renderTrackVertical={props => <div {...props} className="track-vertical" />}
        renderThumbHorizontal={props => <div {...props} className="thumb-horizontal" />}
        renderThumbVertical={props => <div {...props} className="thumb-vertical" />}
        renderView={props => <div {...props} className="view" />}
        {...scrollProps}
      >
        {children}
      </Scrollbars>
    );
  }
}

export default CustomScrollbar;
