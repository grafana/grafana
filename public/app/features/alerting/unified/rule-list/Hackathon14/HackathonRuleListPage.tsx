import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import SparkJoyToggle from 'app/core/components/SparkJoyToggle';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';

import { AlertSearchView } from './AlertSearchView';
import { HackathonAlertSearchInput } from './HackathonAlertSearchBox';
import { PopularAlerts } from './PopularAlerts';
import { RecentVisited } from './RecentVisited';

export const HackathonRuleListPage = ({ onToggleSparkJoy }: { onToggleSparkJoy: () => void }) => {
  const styles = useStyles2(getStyles);

  const renderCenteredTitle = () => (
    <div className={styles.centeredTitle}>
      <h1>Hackathon Rule List</h1>
    </div>
  );

  const isSearching = false;

  return (
    <AlertingPageWrapper
      navId="alert-list"
      renderTitle={(title) => renderCenteredTitle()}
      subTitle=""
      isLoading={false}
      // actions={<RuleListActions />}
      actions={
        <AppChromeUpdate
          actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={onToggleSparkJoy} />]}
        />
      }
    >
      <div className={styles.contentContainer}>
        {isSearching ? (
          <AlertSearchView />
        ) : (
          <>
            <HackathonAlertSearchInput />
            <RecentVisited />
            <PopularAlerts />
          </>
        )}
      </div>
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  contentContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    padding: theme.spacing(2),
    maxWidth: '1000px',
    margin: '0 auto',
  }),
  centeredTitle: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    h1: {
      marginBottom: 0,
      textAlign: 'center',
    },
  }),
});
