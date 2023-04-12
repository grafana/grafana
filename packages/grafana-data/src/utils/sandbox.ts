import React, { Attributes, ComponentType } from 'react';

export function withSandboxWrapper<P>(OriginalComponent: ComponentType<P> | null | undefined): ComponentType<P> {
  if (!OriginalComponent) {
    return () => null;
  }
  function SandboxPanelWrapper(props: P) {
    return React.createElement(
      'div',
      { 'data-plugin-sandbox': true },
      // asserting types because react doesn't play nice with these generics and our types are not correct
      React.createElement(OriginalComponent as ComponentType, props as Attributes)
    );
  }
  return SandboxPanelWrapper;
}
