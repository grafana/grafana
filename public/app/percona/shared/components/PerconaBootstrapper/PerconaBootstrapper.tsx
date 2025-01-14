import React, { useEffect, useState } from 'react';

import { config } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, Modal, useStyles2, useTheme2 } from '@grafana/ui';
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
import { getUpdatesInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Telemetry } from '../../../ui-events/components/Telemetry';
import { useMigrator } from '../../core/hooks/migrator';
import usePerconaTour from '../../core/hooks/tour';
import { checkUpdatesAction } from '../../core/reducers/updates';
import { logger } from '../../helpers/logger';
import { isPmmAdmin } from '../../helpers/permissions';

import { Messages } from './PerconaBootstrapper.messages';
import { getStyles } from './PerconaBootstrapper.styles';
import { PerconaBootstrapperProps } from './PerconaBootstrapper.types';
import PerconaMigrator from './PerconaMigrator';
import PerconaNavigation from './PerconaNavigation/PerconaNavigation';
import PerconaTourBootstrapper from './PerconaTour';
import PerconaUpdateVersion from './PerconaUpdateVersion/PerconaUpdateVersion';

// This component is only responsible for populating the store with Percona's settings initially
export const PerconaBootstrapper = ({ onReady }: PerconaBootstrapperProps) => {
  const dispatch = useAppDispatch();
  const { setSteps, startTour: startPerconaTour, endTour } = usePerconaTour();
  const { updateAvailable, isLoading: isLoadingUpdates, showUpdateModal } = useSelector(getUpdatesInfo);
  const [modalIsOpen, setModalIsOpen] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const styles = useStyles2(getStyles);
  const { user } = config.bootData;
  const { isSignedIn } = user;
  const theme = useTheme2();
  const { migrationSummaryVisible } = useMigrator();

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
        const settings = await dispatch(fetchSettingsAction()).unwrap();
        dispatch(setAuthorized(true));
        return settings;
      } catch (e) {
        // @ts-ignore
        if (e.response?.status === 401) {
          setAuthorized(false);
        } else {
          logger.error(e);
        }
      }

      return null;
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
      if (isPmmAdmin(user)) {
        const settings = await getSettings();
        await dispatch(fetchUserStatusAction());
        await dispatch(fetchAdvisors({ disableNotifications: true }));

        if (settings?.updatesEnabled) {
          await dispatch(checkUpdatesAction());
        }
      }

      await getUserDetails();
      await dispatch(fetchServerInfoAction());
      await dispatch(fetchServerSaasHostAction());
      onReady();
    };

    if (isSignedIn) {
      bootstrap();
    } else {
      onReady();
    }
  }, [dispatch, isSignedIn, setSteps, onReady, user]);

  return (
    <>
      {isSignedIn && <Telemetry />}
      <PerconaNavigation />
      <PerconaTourBootstrapper />
      {isSignedIn && isPmmAdmin(user) && migrationSummaryVisible ? (
        <PerconaMigrator />
      ) : updateAvailable && showUpdateModal && !isLoadingUpdates ? (
        <PerconaUpdateVersion />
      ) : (
        isSignedIn &&
        showTour && (
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
                href="https://per.co.na/pmm_documentation"
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
        )
      )}
    </>
  );
};
