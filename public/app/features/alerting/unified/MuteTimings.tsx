import { useEffect, useState } from 'react';
import { Route, Switch } from 'react-router-dom';
import { Navigate, useMatch } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { useGetMuteTiming } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { useURLSearchParams } from 'app/features/alerting/unified/hooks/useURLSearchParams';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import MuteTimingForm from './components/mute-timings/MuteTimingForm';
import { useAlertmanager } from './state/AlertmanagerContext';

const EditTimingRoute = () => {
  const [queryParams] = useURLSearchParams();
  const { selectedAlertmanager } = useAlertmanager();
  const name = queryParams.get('muteName')!;
  const {
    isLoading,
    data: timeInterval,
    isError,
  } = useGetMuteTiming({
    alertmanager: selectedAlertmanager!,
    name,
  });

  if (!name) {
    return <Navigate replace to="/alerting/routes" />;
  }

  return (
    <MuteTimingForm
      editMode
      loading={isLoading}
      showError={isError}
      muteTiming={timeInterval}
      provisioned={timeInterval?.provisioned}
    />
  );
};

const MuteTimings = () => {
  return (
    <>
      <Switch>
        <Route exact path="/alerting/routes/mute-timing/new">
          <MuteTimingForm />
        </Route>
        <Route exact path="/alerting/routes/mute-timing/edit">
          <EditTimingRoute />
        </Route>
      </Switch>
    </>
  );
};

const MuteTimingsPage = () => {
  const pageNav = useMuteTimingNavData();

  return (
    <AlertmanagerPageWrapper navId="am-routes" pageNav={pageNav} accessType="notification">
      <MuteTimings />
    </AlertmanagerPageWrapper>
  );
};

export function useMuteTimingNavData() {
  const isNewPath = useMatch('/alerting/routes/mute-timing/new');
  const isEditPath = useMatch('/alerting/routes/mute-timing/edit');
  const [pageNav, setPageNav] = useState<Pick<NavModelItem, 'id' | 'text' | 'icon'> | undefined>();

  useEffect(() => {
    if (isNewPath) {
      setPageNav({
        id: 'alert-policy-new',
        text: 'Add mute timing',
      });
    } else if (isEditPath) {
      setPageNav({
        id: 'alert-policy-edit',
        text: 'Edit mute timing',
      });
    }
  }, [isEditPath, isNewPath]);

  return pageNav;
}

export default MuteTimingsPage;
