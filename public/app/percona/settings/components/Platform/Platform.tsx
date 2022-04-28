import React, { FC } from 'react';
import { useStyles2 } from '@grafana/ui';
import { useSelector } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Connected } from './Connected/Connected';
import { Connect } from './Connect/Connect';
import { WithDiagnostics } from '../WithDiagnostics/WithDiagnostics';

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
