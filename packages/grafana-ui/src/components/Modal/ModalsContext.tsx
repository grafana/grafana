import { Component } from 'react';
import * as React from 'react';

export interface ModalsContextState {
  component: React.ComponentType<any> | null;
  props: any;
  showModal: <T>(component: React.ComponentType<T>, props: T) => void;
  hideModal: () => void;
}

export const ModalsContext = React.createContext<ModalsContextState>({
  component: null,
  props: {},
  showModal: () => {},
  hideModal: () => {},
});

interface ModalsProviderProps {
  children: React.ReactNode;
}

/**
 * @deprecated.
 * Not the real implementation used by core.
 */
export class ModalsProvider extends Component<ModalsProviderProps, ModalsContextState> {
  constructor(props: ModalsProviderProps) {
    super(props);
    this.state = {
      component: null,
      props: {},
      showModal: this.showModal,
      hideModal: this.hideModal,
    };
  }

  showModal = <T,>(component: React.ComponentType<T>, props: T) => {
    this.setState({
      component,
      props,
    });
  };

  hideModal = () => {
    this.setState({
      component: null,
      props: {},
    });
  };

  render() {
    return <ModalsContext.Provider value={this.state}>{this.props.children}</ModalsContext.Provider>;
  }
}

export const ModalRoot = () => (
  <ModalsContext.Consumer>
    {({ component: Component, props }) => {
      return Component ? <Component {...props} /> : null;
    }}
  </ModalsContext.Consumer>
);

export const ModalsController = ModalsContext.Consumer;
