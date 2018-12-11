import React, { KeyboardEvent, ComponentType, Component } from 'react';

interface State {
  selected: number;
}

export interface KeyboardNavigationProps {
  onKeyDown: (evt: KeyboardEvent<EventTarget>, maxSelectedIndex: number, onEnterAction: () => void) => void;
  onMouseEnter: (select: number) => void;
  selected: number;
}

const withKeyboardNavigation = <P extends object>(WrappedComponent: ComponentType<P & KeyboardNavigationProps>) => {
  return class WithKeyboardNavigation extends Component<P, State> {
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
        <WrappedComponent {...this.state} {...this.props} onKeyDown={this.onKeyDown} onMouseEnter={this.onMouseEnter} />
      );
    }
  };
};

export default withKeyboardNavigation;
