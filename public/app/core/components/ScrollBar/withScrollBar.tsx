import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

interface WithScrollBarProps {
  customClassName?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHideDuration?: number;
  hideTracksWhenNotNeeded?: boolean;
}

const withScrollBarDefaultProps: Partial<WithScrollBarProps> = {
  customClassName: 'custom-scrollbars',
  autoHide: true,
  autoHideTimeout: 200,
  autoHideDuration: 200,
  hideTracksWhenNotNeeded: false,
};

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
export default function withScrollBar<P extends object>(WrappedComponent: React.ComponentType<P>) {
  return class extends React.Component<P & WithScrollBarProps> {
    static defaultProps = withScrollBarDefaultProps;

    render() {
      // Use type casting here in order to get rest of the props working. See more
      // https://github.com/Microsoft/TypeScript/issues/14409
      // https://github.com/Microsoft/TypeScript/pull/13288
      const { autoHide, autoHideTimeout, autoHideDuration, hideTracksWhenNotNeeded, customClassName, ...props } = this
        .props as WithScrollBarProps;
      const scrollProps = { autoHide, autoHideTimeout, autoHideDuration, hideTracksWhenNotNeeded };

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
          <WrappedComponent {...props} />
        </Scrollbars>
      );
    }
  };
}
