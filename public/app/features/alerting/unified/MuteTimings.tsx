import React from 'react';
import { Route, RouteChildrenProps, Switch } from 'react-router-dom';
import MuteTimingForm from './components/amroutes/MuteTimingForm';

const MuteTimings = () => {
  return (
    <Switch>
      <Route exact path="/alerting/routes/mute-timing/new">
        <MuteTimingForm />
      </Route>
      <Route exact path="/alerting/routes/mute-timing/:id/edit">
        {({ match }: RouteChildrenProps<{ id: string }>) => {
          return match?.params?.id && <MuteTimingForm muteTiming={atob(match.params.id)} />;
        }}
      </Route>
    </Switch>
  );
};

export default MuteTimings;
