import Mousetrap from 'mousetrap';
import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Features, ToggleFeatures } from 'react-enable';

import { NavModelItem } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { H1 } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';

import FEATURES from '../features';
import { SelectedAlertmanagerProvider, useSelectedAlertmanager } from '../state/AlertmanagerContext';

import { AlertManagerPicker } from './AlertManagerPicker';
import { NoAlertManagerWarning } from './NoAlertManagerWarning';
import { Spacer } from './Spacer';

interface Props {
  pageId: string;
  isLoading?: boolean;
  pageNav?: NavModelItem;
  includeAlertmanagerSelector?: boolean;
}

const SHOW_TOGGLES_KEY_COMBO = 'ctrl+1';
const combokeys = new Mousetrap(document.body);

export const AlertingPageWrapper = ({
  children,
  pageId,
  pageNav,
  isLoading,
  includeAlertmanagerSelector = false,
}: React.PropsWithChildren<Props>) => {
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
      <SelectedAlertmanagerProvider>
        <Page
          pageNav={pageNav}
          navId={pageId}
          renderTitle={(title) => (
            <Stack direction="row" alignItems="center" flexGrow={1}>
              <H1>{title}</H1>
              {includeAlertmanagerSelector && (
                <>
                  <Spacer />
                  <AlertManagerPicker />
                </>
              )}
            </Stack>
          )}
        >
          <Page.Contents isLoading={isLoading}>
            <AlertManagerPagePermissionsCheck>{children}</AlertManagerPagePermissionsCheck>
          </Page.Contents>
        </Page>
      </SelectedAlertmanagerProvider>
      {showFeatureToggle ? <ToggleFeatures defaultOpen={true} /> : null}
    </Features>
  );
};

const AlertManagerPagePermissionsCheck = ({ children }: PropsWithChildren) => {
  const { availableAlertManagers, selectedAlertmanager } = useSelectedAlertmanager();

  if (!selectedAlertmanager) {
    return <NoAlertManagerWarning availableAlertManagers={availableAlertManagers} />;
  }

  return <>{children}</>;
};
