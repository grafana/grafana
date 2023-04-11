import React, { useEffect, useState } from 'react';

import { Button, HorizontalGroup, Icon, Modal, useStyles2, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import {
  fetchServerInfoAction,
  fetchServerSaasHostAction,
  fetchSettingsAction,
} from 'app/percona/shared/core/reducers';
import { fetchAdvisors } from 'app/percona/shared/core/reducers/advisors/advisors';
import { TourType } from 'app/percona/shared/core/reducers/tour/tour.types';
import {
  fetchUserDetailsAction,
  fetchUserStatusAction,
  setAuthorized,
} from 'app/percona/shared/core/reducers/user/user';
import { useAppDispatch } from 'app/store/store';

import { Telemetry } from '../../../ui-events/components/Telemetry';
import usePerconaTour from '../../core/hooks/tour';

import { Messages } from './PerconaBootstrapper.messages';
import { getStyles } from './PerconaBootstrapper.styles';
import { PerconaBootstrapperProps } from './PerconaBootstrapper.types';
import PerconaNavigation from './PerconaNavigation/PerconaNavigation';
import PerconaTourBootstrapper from './PerconaTour';

// This component is only responsible for populating the store with Percona's settings initially
export const PerconaBootstrapper = ({ onReady }: PerconaBootstrapperProps) => {
  const dispatch = useAppDispatch();
  const { setSteps, startTour: startPerconaTour, endTour } = usePerconaTour();
  const [modalIsOpen, setModalIsOpen] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const styles = useStyles2(getStyles);
  const isLoggedIn = contextSrv.user.isSignedIn;
  const theme = useTheme2();

  const dismissModal = () => {
    setModalIsOpen(false);
  };

  const finishTour = () => {
    setModalIsOpen(false);
    setShowTour(false);
    endTour(TourType.Product);
  };

  const startTour = () => {
    setModalIsOpen(false);
    startPerconaTour(TourType.Product);
  };

  useEffect(() => {
    const getSettings = async () => {
      try {
        await dispatch(fetchSettingsAction()).unwrap();
        dispatch(setAuthorized(true));
      } catch (e) {
        // @ts-ignore
        if (e.response?.status === 401) {
          setAuthorized(false);
        }
      }
    };

    const getUserDetails = async () => {
      try {
        const details = await dispatch(fetchUserDetailsAction()).unwrap();
        setShowTour(!details.productTourCompleted);
      } catch (e) {
        setShowTour(false);
      }
    };

    const bootstrap = async () => {
      await getSettings();
      await getUserDetails();
      await dispatch(fetchUserStatusAction());
      await dispatch(fetchServerInfoAction());
      await dispatch(fetchServerSaasHostAction());
      await dispatch(fetchAdvisors());
      onReady();
    };

    if (isLoggedIn) {
      bootstrap();
    } else {
      onReady();
    }
  }, [dispatch, isLoggedIn, setSteps, onReady]);

  return (
    <>
      {isLoggedIn && <Telemetry />}
      <PerconaNavigation />
      <PerconaTourBootstrapper />
      {isLoggedIn && showTour && (
        <Modal onDismiss={dismissModal} isOpen={modalIsOpen} title={Messages.title}>
          <div className={styles.iconContainer}>
            <Icon type="mono" name={theme.isLight ? 'pmm-logo-light' : 'pmm-logo'} className={styles.svg} />
          </div>
          <p>
            <strong>{Messages.pmm}</strong>
            {Messages.pmmIs}
          </p>
          <p>
            {Messages.pmmEnables}
            <ul className={styles.list}>
              <li>{Messages.spotCriticalPerformance}</li>
              <li>{Messages.ensureDbPerformance}</li>
              <li>{Messages.backup}</li>
            </ul>
          </p>
          <p>
            {Messages.moreInfo}
            <a
              href="https://docs.percona.com/percona-monitoring-and-management/index.html"
              target="_blank"
              rel="noreferrer noopener"
              className={styles.docsLink}
            >
              {Messages.pmmOnlineHelp}
            </a>
            .
          </p>
          <HorizontalGroup justify="center" spacing="md">
            <Button onClick={startTour} size="lg" className={styles.callToAction}>
              {Messages.startTour}
            </Button>
          </HorizontalGroup>
          <HorizontalGroup justify="flex-end" spacing="md">
            <Button variant="secondary" onClick={finishTour}>
              {Messages.skip}
            </Button>
            <Button variant="secondary" onClick={() => setModalIsOpen(false)}>
              {Messages.checkLater}
            </Button>
          </HorizontalGroup>
        </Modal>
      )}
    </>
  );
};
