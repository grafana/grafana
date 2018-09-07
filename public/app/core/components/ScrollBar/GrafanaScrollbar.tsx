import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

interface GrafanaScrollBarProps {
  customClassName?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHideDuration?: number;
  hideTracksWhenNotNeeded?: boolean;
}

const grafanaScrollBarDefaultProps: Partial<GrafanaScrollBarProps> = {
  customClassName: 'custom-scrollbars',
  autoHide: true,
  autoHideTimeout: 200,
  autoHideDuration: 200,
  hideTracksWhenNotNeeded: false,
};

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
class GrafanaScrollbar extends React.Component<GrafanaScrollBarProps> {
  static defaultProps = grafanaScrollBarDefaultProps;

  render() {
    const { customClassName, children, ...scrollProps } = this.props;

    return (
      <Scrollbars
        className={customClassName}
        autoHeight={true}
        autoHeightMin={'100%'}
        autoHeightMax={'100%'}
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

export default GrafanaScrollbar;
