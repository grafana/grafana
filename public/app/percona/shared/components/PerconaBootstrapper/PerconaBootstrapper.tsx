import { useTour } from '@reactour/tour';
import React, { useState, useEffect } from 'react';
import { useLocalStorage } from 'react-use';

import { Button, HorizontalGroup, Icon, Modal, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import {
  fetchSettingsAction,
  setAuthorized,
  fetchServerInfoAction,
  fetchServerSaasHostAction,
  fetchUserStatusAction,
} from 'app/percona/shared/core/reducers';
import { useDispatch } from 'app/types';

import { isPmmAdmin } from '../../helpers/permissions';

import { Messages } from './PerconaBootstrapper.messages';
import { getStyles } from './PerconaBootstrapper.styles';

// This component is only responsible for populating the store with Percona's settings initially
export const PerconaBootstrapper = () => {
  const dispatch = useDispatch();
  const { setCurrentStep, setIsOpen } = useTour();
  const [modalIsOpen, setModalIsOpen] = useState(true);
  const [showTour, setShowTour] = useLocalStorage<boolean>('percona.showTour', true);
  const styles = useStyles2(getStyles);
  const isLoggedIn = !!contextSrv.user.isSignedIn;

  const dismissModal = () => {
    setModalIsOpen(false);
  };

  const finishTour = () => {
    setModalIsOpen(false);
    setShowTour(false);
  };

  const startTour = () => {
    setModalIsOpen(false);
    setCurrentStep(0);
    setIsOpen(true);
  };

  useEffect(() => {
    const getSettings = async () => {
      try {
        await dispatch(fetchSettingsAction()).unwrap();
        dispatch(setAuthorized(true));
      } catch (e) {
        if (e.response?.status === 401) {
          setAuthorized(false);
        }
      }
    };

    const bootstrap = async () => {
      await getSettings();
      await dispatch(fetchUserStatusAction());
      await dispatch(fetchServerInfoAction());
      await dispatch(fetchServerSaasHostAction());
    };

    if (isLoggedIn) {
      bootstrap();
    }
  }, [dispatch, isLoggedIn, setCurrentStep, setIsOpen]);

  return isLoggedIn && isPmmAdmin(contextSrv.user) && showTour ? (
    <Modal onDismiss={dismissModal} isOpen={modalIsOpen} title=" Welcome to Percona Monitoring and Management">
      <div className={styles.iconContainer}>
        <Icon type="mono" name="pmm-logo" className={styles.svg} />
      </div>
      <p>
        <strong>{Messages.pmm}</strong>
        {Messages.pmmIs}
      </p>
      <p>
        {Messages.pmmEnables}
        <ul className={styles.list}>
          <li>{Messages.spotCriticalPerformance}</li>
          <li>{Messages.monitorDb}</li>
          <li>{Messages.runDbHealth}</li>
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
          Start tour
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
  ) : (
    <></>
  );
};
