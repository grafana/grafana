import { AppRootProps } from '@grafana/data';
import React from 'react';
import { css } from 'emotion';
import { Discover } from 'pages/Discover';
import { Browse } from 'pages/Browse';
import { PluginDetails } from 'pages/PluginDetails';
import { Library } from 'pages/Library';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

export const MarketplaceRootPage = React.memo(function MarketplaceRootPage(props: AppRootProps) {
  return (
    <div
      className={css`
        margin-left: auto;
        margin-right: auto;
        max-width: 980px;
        padding: 48px 16px;
      `}
    >
      <Router>
        <div>
          <Switch>
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
              render={({ match }) => {
                if (!match) {
                  return <div>????</div>;
                }
                return <PluginDetails {...props} />;
              }}
              // render={() => {
              //   return <PluginDetails {...props} />;
              // }}
            />
            <Route
              exact
              path={`${props.basename}/library`}
              render={() => {
                return <Library {...props} />;
              }}
            />
          </Switch>
        </div>
      </Router>
    </div>
  );
});
