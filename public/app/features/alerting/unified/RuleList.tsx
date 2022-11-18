import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAsyncFn, useInterval } from 'react-use';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Button, Icon, LinkButton, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';

import { CombinedRuleNamespace } from '../../../types/unified-alerting';

import { LogMessages } from './Analytics';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoRulesSplash } from './components/rules/NoRulesCTA';
import { RuleListErrors } from './components/rules/RuleListErrors';
import { RuleListGroupView } from './components/rules/RuleListGroupView';
import { RuleListStateView } from './components/rules/RuleListStateView';
import { RuleStats } from './components/rules/RuleStats';
import RulesFilter from './components/rules/RulesFilter';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { useFilteredRules } from './hooks/useFilteredRules';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAllPromAndRulerRulesAction } from './state/actions';
import { useRulesAccess } from './utils/accessControlHooks';
import { RULE_LIST_POLL_INTERVAL_MS } from './utils/constants';
import { getAllRulesSourceNames } from './utils/datasource';
import { getFiltersFromUrlParams } from './utils/misc';

const VIEWS = {
  groups: RuleListGroupView,
  state: RuleListStateView,
};

const RuleList = withErrorBoundary(
  () => {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);
    const location = useLocation();
    const [expandAll, setExpandAll] = useState(false);

    const [queryParams] = useQueryParams();
    const filters = getFiltersFromUrlParams(queryParams);
    const filtersActive = Object.values(filters).some((filter) => filter !== undefined);

    const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();

    const view = VIEWS[queryParams['view'] as keyof typeof VIEWS]
      ? (queryParams['view'] as keyof typeof VIEWS)
      : 'groups';

    const ViewComponent = VIEWS[view];

    const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

    const loading = rulesDataSourceNames.some(
      (name) => promRuleRequests[name]?.loading || rulerRuleRequests[name]?.loading
    );

    const promRequests = Object.entries(promRuleRequests);
    const allPromLoaded = promRequests.every(
      ([_, state]) => state.dispatched && (state?.result !== undefined || state?.error !== undefined)
    );
    const allPromEmpty = promRequests.every(([_, state]) => state.dispatched && state?.result?.length === 0);

    // Trigger data refresh only when the RULE_LIST_POLL_INTERVAL_MS elapsed since the previous load FINISHED
    const [_, fetchRules] = useAsyncFn(async () => {
      if (!loading) {
        await dispatch(fetchAllPromAndRulerRulesAction());
      }
    }, [loading]);

    // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
    useEffect(() => {
      dispatch(fetchAllPromAndRulerRulesAction());
    }, [dispatch]);
    useInterval(fetchRules, RULE_LIST_POLL_INTERVAL_MS);

    // Show splash only when we loaded all of the data sources and none of them has alerts
    const hasNoAlertRulesCreatedYet = allPromLoaded && allPromEmpty && promRequests.length > 0;

    const combinedNamespaces: CombinedRuleNamespace[] = useCombinedRuleNamespaces();
    const filteredNamespaces = useFilteredRules(combinedNamespaces);
    return (
      // We don't want to show the Loading... indicator for the whole page.
      // We show separate indicators for Grafana-managed and Cloud rules
      <AlertingPageWrapper pageId="alert-list" isLoading={false}>
        <RuleListErrors />
        <RulesFilter />
        {!hasNoAlertRulesCreatedYet && (
          <>
            <div className={styles.break} />
            <div className={styles.buttonsContainer}>
              <div className={styles.statsContainer}>
                {view === 'groups' && filtersActive && (
                  <Button
                    className={styles.expandAllButton}
                    icon={expandAll ? 'angle-double-up' : 'angle-double-down'}
                    variant="secondary"
                    onClick={() => setExpandAll(!expandAll)}
                  >
                    {expandAll ? 'Collapse all' : 'Expand all'}
                  </Button>
                )}
                <RuleStats showInactive={true} showRecording={true} namespaces={filteredNamespaces} />
              </div>
              {(canCreateGrafanaRules || canCreateCloudRules) && (
                <LinkButton
                  href={urlUtil.renderUrl('alerting/new', { returnTo: location.pathname + location.search })}
                  icon="plus"
                  onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
                >
                  New alert rule
                </LinkButton>
              )}
            </div>
          </>
        )}
        {hasNoAlertRulesCreatedYet && <NoRulesSplash />}
        {!hasNoAlertRulesCreatedYet && <ViewComponent expandAll={expandAll} namespaces={filteredNamespaces} />}
      </AlertingPageWrapper>
    );
  },
  { style: 'page' }
);

const getStyles = (theme: GrafanaTheme2) => ({
  break: css`
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing(2)};
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
  buttonsContainer: css`
    margin-bottom: ${theme.spacing(2)};
    display: flex;
    justify-content: space-between;
  `,
  statsContainer: css`
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
  expandAllButton: css`
    margin-right: ${theme.spacing(1)};
  `,
});

function WelcomePage() {
  const styles = useStyles2(getWelcomePageStyles);

  return (
    <AlertingPageWrapper pageId="alert-list">
      <div className={styles.grid}>
        <WelcomeHeader />
      </div>
    </AlertingPageWrapper>
  );
}

const getWelcomePageStyles = (theme: GrafanaTheme2) => ({
  grid: css`
    display: grid;
    gap: ${theme.spacing(2)};
  `,
});

function WelcomeHeader() {
  const styles = useStyles2(getWelcomeHeaderStyles);

  return (
    <div className={styles.container}>
      <h2>What you can do</h2>
      <a href="https://grafana.com/docs/grafana/latest/alerting/" className={styles.docsLink}>
        Read more in the Alerting Docs <Icon name="angle-right" size="xl" className={styles.docsArrow} />
      </a>

      <div className={styles.ctaContainer}>
        <WelcomeCTABox
          title="Manage alert rules"
          description="Manage your alert rules. Combine data from multiple data sources"
          icon="list-ul"
          href="/alerting/new"
          hrefText="Create a rule"
        />
        <WelcomeCTABox
          title="Manage notification policies"
          description="Configure where your alerts are delivered"
          icon="sitemap"
          href="/alerting/routes"
          hrefText="Check configuration"
        />
        <WelcomeCTABox
          title="Manage contact points"
          description="Configure who and how receives notifications"
          icon="comment-alt-share"
          href="/alerting/notifications"
          hrefText="Configure contact points"
        />
      </div>
    </div>
  );
}

const getWelcomeHeaderStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    padding: ${theme.spacing(4)};
    background-image: linear-gradient(
      325deg,
      hsl(36deg 96% 66%) 0%,
      hsl(29deg 96% 66%) 52%,
      hsl(21deg 96% 66%) 77%,
      hsl(10deg 90% 67%) 91%,
      hsl(356deg 76% 68%) 99%,
      hsl(341deg 61% 69%) 100%
    );
  `,
  ctaContainer: css`
    display: flex;
    gap: ${theme.spacing(2)};
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  docsLink: css`
    display: block;
    color: ${theme.colors.text.link};
  `,
  docsArrow: css`
    //vertical-align: top;
  `,
});

interface WelcomeCTABoxProps {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  href: string;
  hrefText: string;
}

function WelcomeCTABox({ title, description, icon, href, hrefText }: WelcomeCTABoxProps) {
  const styles = useStyles2(getWelcomeCTAButtonStyles);

  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Icon name={icon} size="xxl" />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.desc}>{description}</div>
      <LinkButton href={href} className={styles.actionButton}>
        {hrefText}
      </LinkButton>
    </div>
  );
}

const getWelcomeCTAButtonStyles = (theme: GrafanaTheme2) => ({
  container: css`
    flex: 1;
    min-width: 240px;
    display: grid;
    gap: ${theme.spacing(1)};
    grid-template-columns: min-content 1fr 1fr 1fr;
    grid-template-rows: min-content auto min-content;
  `,

  title: css`
    grid-column: 2 / span 3;
    grid-row: 1;
  `,

  desc: css`
    grid-column: 2 / span 3;
    grid-row: 2;
  `,

  actionButton: css`
    grid-column: 2 / span 3;
    grid-row: 3;
  `,

  icon: css`
    grid-column: 1;
    grid-row: 1 / span 2;
    margin: auto;
  `,
});

export default WelcomePage;
