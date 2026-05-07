import { useCallback, useMemo, useState } from 'react';
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
export function ModalsProvider({ children }: ModalsProviderProps) {
  const [component, setComponent] = useState<ModalsContextState['component']>(null);
  const [props, setProps] = useState<ModalsContextState['props']>({});

  const showModal = useCallback(<T,>(component: React.ComponentType<T>, props: T) => {
    setComponent(() => component);
    setProps(props);
  }, []);

  const hideModal = useCallback(() => {
    setComponent(null);
    setProps({});
  }, []);

  const value = useMemo(() => ({ component, props, showModal, hideModal }), [component, props, showModal, hideModal]);

  return <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>;
}

export const ModalRoot = () => (
  <ModalsContext.Consumer>
    {({ component: Component, props }) => {
      return Component ? <Component {...props} /> : null;
    }}
  </ModalsContext.Consumer>
);

export const ModalsController = ModalsContext.Consumer;
