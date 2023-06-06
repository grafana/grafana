import React, { Attributes, ComponentType } from 'react';

import { PluginMeta, PluginSignatureStatus } from '../types';

/**
 * Wraps a component in a sandboxed wrapper
 */
export function withSandboxWrapper<P>(
  OriginalComponent: ComponentType<P> | null | undefined,
  meta: PluginMeta | undefined
): ComponentType<P> {
  if (!OriginalComponent) {
    return () => null;
  }

  if (meta?.angularDetected || meta?.signature === PluginSignatureStatus.internal) {
    return OriginalComponent;
  }

  function SandboxPanelWrapper(props: P) {
    return React.createElement(
      'div',
      { 'data-plugin-sandbox': 'sandboxed-plugin' },
      // asserting types because react doesn't play nice with these generics and our types are not correct
      React.createElement(OriginalComponent as ComponentType, props as Attributes)
    );
  }
  return SandboxPanelWrapper;
}
