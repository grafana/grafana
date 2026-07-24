import { type PropsWithChildren, type ReactNode, useMemo } from 'react';
import { useLocation } from 'react-use';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { type PageProps } from 'app/core/components/Page/types';

import { useImportEntrypointState } from '../hooks/useImportEntrypointState';
import { AlertmanagerProvider, useAlertmanager } from '../state/AlertmanagerContext';
import { getAlertManagerDataSourcesByPermission } from '../utils/datasource';

import { AlertManagerPicker } from './AlertManagerPicker';
import { NoAlertManagerWarning } from './NoAlertManagerWarning';
import { ImportToGMABanner } from './import-to-gma/ImportToGMABanner';
import { useCanImportToGMA } from './import-to-gma/useCanImportToGMA';

/**
 * This is the main alerting page wrapper, used by the alertmanager page wrapper and the alert rules list view
 *
 * NOTE: we're omitting "title" here because it's not actually rendering the title (it's the html attribute "title").
 * Use "renderTitle" instead for custom page titles.
 */
type AlertingPageWrapperProps = Omit<PageProps, 'children' | 'title'> & {
  isLoading?: boolean;
  children?: ReactNode;
};

export const AlertingPageWrapper = ({ children, isLoading, ...rest }: AlertingPageWrapperProps) => (
  <Page {...rest}>
    <Page.Contents isLoading={isLoading}>{children}</Page.Contents>
  </Page>
);

/**
 * This wrapper is for pages that use the Alertmanager API
 */
interface AlertmanagerPageWrapperProps extends AlertingPageWrapperProps {
  accessType: 'instance' | 'notification';
}
export const AlertmanagerPageWrapper = ({ children, accessType, ...props }: AlertmanagerPageWrapperProps) => {
  const disableAlertmanager = useIsDisabledAlertmanagerSelection();
  // Check if there are any external Alertmanager data sources the user can access
  // If so, show the AlertManagerPicker so users can switch between them
  const hasExternalAlertmanagers = useMemo(
    () => getAlertManagerDataSourcesByPermission(accessType).availableExternalDataSources.length > 0,
    [accessType]
  );

  return (
    <AlertmanagerProvider accessType={accessType}>
      <AlertingPageWrapper
        {...props}
        actions={hasExternalAlertmanagers && <AlertManagerPicker disabled={disableAlertmanager} />}
      >
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

  return (
    <>
      <ImportToGMABannerForAlertmanager />
      {children}
    </>
  );
};

/**
 * Invites the user to import an external Alertmanager's configuration into
 * Grafana-managed alerting. Only rendered once a valid Alertmanager is selected. Suppressed on edit/new forms, where the Alertmanager picker is disabled and a
 * promo banner is noise.
 */
function ImportToGMABannerForAlertmanager() {
  const { isGrafanaAlertmanager } = useAlertmanager();
  const { canImportNotifications } = useCanImportToGMA();
  const isEditOrNewForm = useIsDisabledAlertmanagerSelection();
  const { disabled: importDisabled, isLoading: importStateLoading } = useImportEntrypointState();

  const showBanner =
    Boolean(config.featureToggles.alertingMigrationWizardUI) &&
    !isGrafanaAlertmanager &&
    canImportNotifications &&
    !isEditOrNewForm &&
    !importDisabled &&
    !importStateLoading;

  return showBanner ? <ImportToGMABanner /> : null;
}
