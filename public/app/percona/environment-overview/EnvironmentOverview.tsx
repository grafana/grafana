import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { PMM_ENVIRONMENT_OVERVIEW_PAGE } from '../shared/components/PerconaBootstrapper/PerconaNavigation';

import { getStyles } from './EnvironmentOverview.styles';
import Contact from './components/ContactWidget/Contact';

export const EnvironmentOverview = () => {
  const styles = useStyles2(getStyles);

  return (
    <Page
      navModel={{
        main: PMM_ENVIRONMENT_OVERVIEW_PAGE,
        node: PMM_ENVIRONMENT_OVERVIEW_PAGE,
      }}
    >
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
