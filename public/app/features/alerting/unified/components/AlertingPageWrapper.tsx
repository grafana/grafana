import Mousetrap from 'mousetrap';
import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Features, ToggleFeatures } from 'react-enable';
import { useLocation } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import FEATURES from '../features';
import { AlertmanagerProvider, useAlertmanager } from '../state/AlertmanagerContext';

import { AlertManagerPicker } from './AlertManagerPicker';
import { NoAlertManagerWarning } from './NoAlertManagerWarning';

const SHOW_TOGGLES_KEY_COMBO = 'ctrl+1';
const combokeys = new Mousetrap(document.body);

/**
 * This is the main alerting page wrapper, used by the alertmanager page wrapper and the alert rules list view
 */
interface AlertingPageWrapperProps extends PropsWithChildren {
  pageId: string;
  isLoading?: boolean;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}
export const AlertingPageWrapper = ({ children, pageId, pageNav, actions, isLoading }: AlertingPageWrapperProps) => {
  const [showFeatureToggle, setShowFeatureToggles] = useState(false);

  useEffect(() => {
    combokeys.bind(SHOW_TOGGLES_KEY_COMBO, () => {
      setShowFeatureToggles((show) => !show);
    });

    return () => {
      combokeys.unbind(SHOW_TOGGLES_KEY_COMBO);
    };
  }, []);

  return (
    <Features features={FEATURES}>
      <Page pageNav={pageNav} navId={pageId} actions={actions}>
        <Page.Contents isLoading={isLoading}>{children}</Page.Contents>
      </Page>
      {showFeatureToggle ? <ToggleFeatures defaultOpen={true} /> : null}
    </Features>
  );
};

/**
 * This wrapper is for pages that use the Alertmanager API
 */
interface AlertmanagerPageWrapperProps extends AlertingPageWrapperProps {
  accessType: 'instance' | 'notification';
}
export const AlertmanagerPageWrapper = ({ children, accessType, ...props }: AlertmanagerPageWrapperProps) => {
  const disableAlertmanager = useIsDisabledAlertmanagerSelection();

  return (
    <AlertmanagerProvider accessType={accessType}>
      <AlertingPageWrapper {...props} actions={<AlertManagerPicker disabled={disableAlertmanager} />}>
        <AlertManagerPagePermissionsCheck>{children}</AlertManagerPagePermissionsCheck>
      </AlertingPageWrapper>
    </AlertmanagerProvider>
  );
};

/**
 * This function tells us when we want to disable the alertmanager picker
 * It's not great...
 */
function useIsDisabledAlertmanagerSelection() {
  const location = useLocation();
  const disabledPathSegment = ['/edit', '/new'];

  return disabledPathSegment.some((match) => location?.pathname?.includes(match));
}

/**
 * This component will render an error message if the user doesn't have sufficient permissions or if the requested
 * alertmanager doesn't exist
 */
const AlertManagerPagePermissionsCheck = ({ children }: PropsWithChildren) => {
  const { availableAlertManagers, selectedAlertmanager } = useAlertmanager();

  if (!selectedAlertmanager) {
    return <NoAlertManagerWarning availableAlertManagers={availableAlertManagers} />;
  }

  return <>{children}</>;
};
