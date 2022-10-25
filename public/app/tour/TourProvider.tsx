import React from 'react';
import { TourProvider } from '@reactour/tour';
import getSteps from './steps';
import { isPmmAdmin } from '../percona/shared/helpers/permissions';
import { contextSrv } from '../core/services/context_srv';
import Close from './Close';
import Navigation from './Navigation';
import { useAppDispatch } from 'app/store/store';
import { setProductTourCompleted } from 'app/percona/shared/core/reducers/user/user';
import { getTheme } from '@grafana/ui';
import { config } from '@grafana/runtime';

const PerconaTourProvider: React.FC = ({ children }) => {
  const dispatch = useAppDispatch();

  return (
    <TourProvider
      steps={getSteps(isPmmAdmin(contextSrv.user))}
      components={{ Close, Navigation }}
      showBadge={false}
      badgeContent={({ totalSteps, currentStep }) => `${currentStep + 1}/${totalSteps}`}
      disableFocusLock
      onClickClose={({ setIsOpen }) => {
        dispatch(setProductTourCompleted(true));
        setIsOpen(false);
      }}
      className="pmm-tour"
      styles={{
        popover: (base) => ({
          ...base,
          backgroundColor: getTheme(config.bootData.user.lightTheme ? 'light' : 'dark').colors.bg1,
        }),
      }}
    >
      {children}
    </TourProvider>
  );
};

export default PerconaTourProvider;
