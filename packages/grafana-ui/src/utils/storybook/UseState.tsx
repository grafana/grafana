import React from 'react';

interface StateHolderProps<T> {
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
    console.log(nextState);
    this.setState({ value: nextState });
  };

  render() {
    return this.props.children(this.state.value, this.handleStateUpdate);
  }
}
