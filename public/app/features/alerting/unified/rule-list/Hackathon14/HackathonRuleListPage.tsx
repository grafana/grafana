import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import SparkJoyToggle from 'app/core/components/SparkJoyToggle';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';

import { AlertSearchView } from './AlertSearchView';
import { HackathonAlertSearchInput } from './HackathonAlertSearchBox';
import { PopularAlerts } from './PopularAlerts';
import { RecentVisited } from './RecentVisited';
import { Stack } from 'app/plugins/datasource/grafana-pyroscope-datasource/QueryEditor/Stack';

export const HackathonRuleListPage = ({ onToggleSparkJoy }: { onToggleSparkJoy: () => void }) => {
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState({
    firing: false,
    ownedByMe: false,
  });

  const renderCenteredTitle = () => (
    <div className={styles.centeredTitle}>
      <h1>Alert Rules</h1>
    </div>
  );

  const isSearching = searchQuery.length > 0 || searchFilters.firing || searchFilters.ownedByMe;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleFilterChange = (filters: { firing: boolean; ownedByMe: boolean }) => {
    setSearchFilters(filters);
  };

  return (
    <AlertingPageWrapper
      navId="alert-list"
      renderTitle={(title) => renderCenteredTitle()}
      subTitle=""
      isLoading={false}
      // actions={<RuleListActions />}
      actions={
        <>        
          <AppChromeUpdate
            actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={onToggleSparkJoy} />]}
          />
                       <Button icon="plus" variant="secondary">Add</Button>
        </>
      }
    >
      <div className={styles.contentContainer}>
        <HackathonAlertSearchInput onSearchChange={handleSearchChange} onFilterChange={handleFilterChange} />
        {isSearching ? (
          <AlertSearchView query={searchQuery} filters={searchFilters} />
        ) : (
          <>
            <RecentVisited />
            <PopularAlerts />
          </>
        )}

        <Stack alignItems="center">
          <Button>View All (I'm not implement yet)</Button>
        </Stack>
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
