import React, { useEffect } from 'react';

import { usePageComponents, usePageContext } from '@grafana/assistant';

/**
 * Debug component to verify assistant context and component registration.
 * Add this temporarily to ExploreMapPage to see what's registered.
 */
export const DebugAssistantContext: React.FC = () => {
  const pageComponents = usePageComponents();
  const pageContext = usePageContext();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.group('🔍 Assistant Debug Info');
    // eslint-disable-next-line no-console
    console.log('Current URL:', window.location.pathname);
    // eslint-disable-next-line no-console
    console.log('Registered Components:', Object.keys(pageComponents));
    // eslint-disable-next-line no-console
    console.log('Component Details:', pageComponents);
    // eslint-disable-next-line no-console
    console.log('Page Context Items:', pageContext.length);
    // eslint-disable-next-line no-console
    console.log('Page Context:', pageContext);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [pageComponents, pageContext]);

  return null;
};
