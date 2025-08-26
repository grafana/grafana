import { GlobalStyles } from '@grafana/ui';

import { useExtensionSidebarContext } from './ExtensionSidebarProvider';

/**
 * This component is used to wrap the GlobalStyles component and pass the isExtensionSidebarOpen prop to it.
 * Since GlobalStyles is imported from @grafana/ui, we need to wrap it in a component to use the useExtensionSidebarContext hook.
 */
export const GlobalStylesWrapper = () => {
  const { isOpen } = useExtensionSidebarContext();

  return <GlobalStyles isExtensionSidebarOpen={isOpen} />;
};
