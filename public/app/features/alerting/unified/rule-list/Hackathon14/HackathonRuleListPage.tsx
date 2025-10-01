import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { TextLink, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import SparkJoyToggle from 'app/core/components/SparkJoyToggle';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RuleListActions } from '../RuleList.v2';

import { AlertSearchView } from './AlertSearchView';
import { HackathonAlertSearchInput } from './HackathonAlertSearchBox';
import { PopularAlerts } from './PopularAlerts';
import { RecentVisited } from './RecentVisited';

export const HackathonRuleListPage = ({ onToggleSparkJoy }: { onToggleSparkJoy: () => void }) => {
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState({
    firing: false,
    ownedByMe: false,
  });
  const { hasActiveFilters } = useRulesFilter();

  const renderCenteredTitle = () => (
    <div className={styles.centeredTitle}>
      <div className={styles.titleBlock}>
        <h1>
          <Trans i18nKey="alerting.hackathon.alert-rules">Alert Rules</Trans>
        </h1>
        <div className={styles.centeredSubTitle}>
          {t('nav.alerting-list.subtitle', 'Rules that determine whether an alert will fire')}
        </div>
      </div>
      <div className={styles.actionsRight}>
        <AppChromeUpdate
          actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={onToggleSparkJoy} />]}
        />
        <RuleListActions />
      </div>
    </div>
  );

  const isSearching = hasActiveFilters || searchQuery.length > 0 || searchFilters.firing || searchFilters.ownedByMe;

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
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    width: '100%',
    textAlign: 'center',
  }),
  titleBlock: css({
    gridColumn: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    h1: {
      marginBottom: theme.spacing(1),
      textAlign: 'center',
    },
  }),
  centeredSubTitle: css({
    color: theme.colors.text.secondary,
    marginBottom: 0,
  }),
  actionsRight: css({
    gridColumn: 3,
    justifySelf: 'end',
    display: 'flex',
    gap: theme.spacing(1),
  }),
});
