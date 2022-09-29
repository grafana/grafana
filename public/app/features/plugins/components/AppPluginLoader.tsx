import React, { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { NavModel } from '@grafana/data';
import { getWarningNav } from 'app/angular/services/nav_model_srv';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';

import { useImportAppPlugin } from '../hooks/useImportAppPlugin';

type AppPluginLoaderProps = {
  // The id of the app plugin to be loaded
  id: string;
  // The base URL path - defaults to the current path
  basePath?: string;
};

// This component can be used to render an app-plugin based on its plugin ID.
export const AppPluginLoader = ({ id, basePath }: AppPluginLoaderProps) => {
  const [nav, setNav] = useState<NavModel | null>(null);
  const { value: plugin, error, loading } = useImportAppPlugin(id);
  const queryParams = useParams();
  const { pathname } = useLocation();

  if (error) {
    return <Page.Header navItem={getWarningNav(error.message, error.stack).main} />;
  }

  return (
    <>
      {loading && <PageLoader />}
      {nav && <Page.Header navItem={nav.main} />}
      {!loading && plugin && plugin.root && (
        <plugin.root
          meta={plugin.meta}
          basename={basePath || pathname}
          onNavChanged={setNav}
          query={queryParams}
          path={pathname}
        />
      )}
    </>
  );
};
