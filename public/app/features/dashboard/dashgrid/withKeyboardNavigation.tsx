import React from 'react';
import { Props as DataSourceProps } from './DataSourcePicker';
import { Props as VizTypeProps } from './VizTypePicker';

interface State {
  selected: number;
}

export interface KeyboardNavigationProps {
  selected?: number;
  onKeyDown?: (evt: React.KeyboardEvent<EventTarget>, maxSelectedIndex: number, onEnterAction: () => void) => void;
  onMouseEnter?: (select: number) => void;
}

const withKeyboardNavigation = WrappedComponent => {
  return class extends React.Component<DataSourceProps | VizTypeProps, State> {
    constructor(props) {
      super(props);

      this.state = {
        selected: 0,
      };
    }

    goToNext = (maxSelectedIndex: number) => {
      const nextIndex = this.state.selected >= maxSelectedIndex ? 0 : this.state.selected + 1;
      this.setState({
        selected: nextIndex,
      });
    };

    goToPrev = (maxSelectedIndex: number) => {
      const nextIndex = this.state.selected <= 0 ? maxSelectedIndex : this.state.selected - 1;
      this.setState({
        selected: nextIndex,
      });
    };

    onKeyDown = (evt: KeyboardEvent, maxSelectedIndex: number, onEnterAction: any) => {
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        this.goToNext(maxSelectedIndex);
      }
      if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        this.goToPrev(maxSelectedIndex);
      }
      if (evt.key === 'Enter' && onEnterAction) {
        onEnterAction();
      }
    };

    onMouseEnter = (mouseEnterIndex: number) => {
      this.setState({
        selected: mouseEnterIndex,
      });
    };

    render() {
      return (
        <WrappedComponent
          selected={this.state.selected}
          onKeyDown={this.onKeyDown}
          onMouseEnter={this.onMouseEnter}
          {...this.props}
        />
      );
    }
  };
};

export default withKeyboardNavigation;
