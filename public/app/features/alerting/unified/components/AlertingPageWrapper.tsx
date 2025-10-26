import { PropsWithChildren, ReactNode } from 'react';
import { useLocation } from 'react-use';

import { Page } from 'app/core/components/Page/Page';
import { PageProps } from 'app/core/components/Page/types';

import { AlertmanagerProvider, useAlertmanager } from '../state/AlertmanagerContext';

import { AlertManagerPicker } from './AlertManagerPicker';
import { NoAlertManagerWarning } from './NoAlertManagerWarning';

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
