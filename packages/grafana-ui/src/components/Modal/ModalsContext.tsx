import React from 'react';
import { Portal } from '../Portal/Portal';

interface ModalsContextState {
  component: React.ComponentType<any> | null;
  props: any;
  showModal: <T>(component: React.ComponentType<T>, props: T) => void;
  hideModal: () => void;
}

const ModalsContext = React.createContext<ModalsContextState>({
  component: null,
  props: {},
  showModal: () => {},
  hideModal: () => {},
});

interface ModalsProviderProps {
  children: React.ReactNode;
}
export class ModalsProvider extends React.Component<ModalsProviderProps, ModalsContextState> {
  constructor(props: ModalsProviderProps) {
    super(props);
    this.state = {
      component: null,
      props: {},
      showModal: this.showModal,
      hideModal: this.hideModal,
    };
  }

  showModal = (component: React.ComponentType<any>, props: any) => {
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
      return Component ? (
        <Portal>
          <Component {...props} />
        </Portal>
      ) : null;
    }}
  </ModalsContext.Consumer>
);

export const ModalsController = ModalsContext.Consumer;
