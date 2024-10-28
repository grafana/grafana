import * as React from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import { useNavigation, prefixRoute } from 'utils/utils.routing';
import { ROUTES } from '../../constants';
import { MainPage } from '../../pages';

export const Routes = () => {
  useNavigation();

  return (
    <Switch>
      <Route exact path={prefixRoute(ROUTES.Main)} component={MainPage} />

      {/* Default page */}
      <Route exact path="*">
        <Redirect to={prefixRoute(ROUTES.Main)} />
      </Route>
    </Switch>
  );
};
