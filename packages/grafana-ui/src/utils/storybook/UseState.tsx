import React from 'react';
import { action } from '@storybook/addon-actions';

interface StateHolderProps<T> {
  logState?: boolean;
  initialState: T;
  children: (currentState: T, updateState: (nextState: T) => void) => React.ReactNode;
}

export class UseState<T> extends React.Component<StateHolderProps<T>, { value: T; initialState: T }> {
  constructor(props: StateHolderProps<T>) {
    super(props);
    this.state = {
      value: props.initialState,
      initialState: props.initialState, // To enable control from knobs
    };
  }
  // @ts-ignore
  static getDerivedStateFromProps(props: StateHolderProps<{}>, state: { value: any; initialState: any }) {
    if (props.initialState !== state.initialState) {
      return {
        initialState: props.initialState,
        value: props.initialState,
      };
    }
    return {
      ...state,
      value: state.value,
    };
  }

  handleStateUpdate = (nextState: T) => {
    this.setState({ value: nextState });
  };

  render() {
    if (this.props.logState) {
      action('UseState current state')(this.state.value);
    }
    return this.props.children(this.state.value, this.handleStateUpdate);
  }
}
