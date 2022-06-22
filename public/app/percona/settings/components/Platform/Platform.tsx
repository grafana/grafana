import React, { FC } from 'react';
import { useSelector } from 'react-redux';

import { useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';

import { WithDiagnostics } from '../WithDiagnostics/WithDiagnostics';

import { Connect } from './Connect/Connect';
import { Connected } from './Connected/Connected';

export const Platform: FC = () => {
  const navModel = usePerconaNavModel('settings-percona-platform');
  const settingsStyles = useStyles2(getSettingsStyles);
  const { result } = useSelector(getPerconaSettings);
  return (
    <Page navModel={navModel} vertical tabsDataTestId="settings-tabs">
      <Page.Contents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          <WithDiagnostics>{result?.isConnectedToPortal ? <Connected /> : <Connect />}</WithDiagnostics>
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default Platform;
