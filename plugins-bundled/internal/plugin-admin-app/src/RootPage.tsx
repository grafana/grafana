import { AppRootProps } from '@grafana/data';
import React from 'react';
import { Discover } from 'pages/Discover';
import { Browse } from 'pages/Browse';
import { PluginDetails } from 'pages/PluginDetails';
import { Library } from 'pages/Library';
import { Route } from 'react-router-dom';
import { config } from '@grafana/runtime';
import { NotEnabled } from 'pages/NotEnabed';

export const CatalogRootPage = React.memo(function CatalogRootPage(props: AppRootProps) {
  if (!config.pluginAdminEnabled) {
    return <NotEnabled {...props} />;
  }

  return (
    <>
      <Route
        exact
        path={`${props.basename}`}
        render={() => {
          return <Browse {...props} />; // or discover?
        }}
      />

      <Route
        exact
        path={`${props.basename}/browse`}
        render={() => {
          return <Browse {...props} />;
        }}
      />

      <Route
        exact
        path={`${props.basename}/discover`}
        render={() => {
          return <Discover {...props} />;
        }}
      />

      <Route
        path={`${props.basename}/plugin/:pluginId`}
        render={() => {
          return <PluginDetails {...props} />;
        }}
      />

      <Route
        exact
        path={`${props.basename}/library`}
        render={() => {
          return <Library {...props} />;
        }}
      />
    </>
  );
});
