import React from 'react';
import { useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { usePerconaNavModel } from '../shared/components/hooks/perconaNavModel';
import Contact from './components/ContactWidget/Contact';
import { getStyles } from './EnvironmentOverview.styles';

export const EnvironmentOverview = () => {
  const styles = useStyles2(getStyles);
  const navModel = usePerconaNavModel('environment-overview');

  return (
    <Page navModel={navModel}>
      <Page.Contents dataTestId="page-wrapper-environment-overview">
        <PlatformConnectedLoader>
          <div className={styles.widgetsWrapper}>
            <Contact />
          </div>
        </PlatformConnectedLoader>
      </Page.Contents>
    </Page>
  );
};

export default EnvironmentOverview;
