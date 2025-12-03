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
    // Debug logging disabled to reduce console noise
    // Uncomment if needed for assistant debugging
    // console.group('🔍 Assistant Debug Info');
    // console.log('Current URL:', window.location.pathname);
    // console.log('Registered Components:', Object.keys(pageComponents));
    // console.log('Component Details:', pageComponents);
    // console.log('Page Context Items:', pageContext.length);
    // console.log('Page Context:', pageContext);
    // console.groupEnd();
  }, [pageComponents, pageContext]);

  return null;
};
