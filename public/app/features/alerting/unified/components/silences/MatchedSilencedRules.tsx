import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useDebounce } from 'react-use';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Badge, useStyles2 } from '@grafana/ui';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { RuleState } from '../rules/RuleState';
import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { Annotation } from '../../utils/constants';
import { findAlertRulesWithMatchers } from '../../utils/matchers';
import { fetchAllPromAndRulerRulesAction } from '../../state/actions';
import { CombinedRule } from 'app/types/unified-alerting';
import { MatcherFieldValue, SilenceFormFields } from '../../types/silence-form';

type MatchedRulesTableItemProps = DynamicTableItemProps<{
  matchedRule: CombinedRule;
}>;
type MatchedRulesTableColumnProps = DynamicTableColumnProps<{ matchedRule: CombinedRule }>;

export const MatchedSilencedRules = () => {
  const [matchedAlertRules, setMatchedAlertRules] = useState<MatchedRulesTableItemProps[]>([]);
  const formApi = useFormContext<SilenceFormFields>();
  const dispatch = useDispatch();
  const { watch } = formApi;
  const matchers: MatcherFieldValue[] = watch('matchers');
  const styles = useStyles2(getStyles);
  const columns = useColumns();

  useEffect(() => {
    dispatch(fetchAllPromAndRulerRulesAction());
  }, [dispatch]);

  const combinedNamespaces = useCombinedRuleNamespaces();
  useDebounce(
    () => {
      const matchedRules = combinedNamespaces.flatMap((namespace) => {
        return namespace.groups.flatMap((group) => {
          return findAlertRulesWithMatchers(group.rules, matchers);
        });
      });
      setMatchedAlertRules(matchedRules);
    },
    500,
    [combinedNamespaces, matchers]
  );

  return (
    <div>
      <h4 className={styles.title}>
        Affected alerts
        {matchedAlertRules.length > 0 ? (
          <Badge className={styles.badge} color="blue" text={matchedAlertRules.length} />
        ) : null}
      </h4>
      <div className={styles.table}>
        {matchers.every((matcher) => !matcher.value && !matcher.name) ? (
          <span>Add a valid matcher to see affected alerts</span>
        ) : (
          <>
            <DynamicTable items={matchedAlertRules.slice(0, 5) ?? []} isExpandable={false} cols={columns} />
            {matchedAlertRules.length > 5 && (
              <div className={styles.moreMatches}>and {matchedAlertRules.length - 5} more</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function useColumns(): MatchedRulesTableColumnProps[] {
  return [
    {
      id: 'state',
      label: 'State',
      renderCell: function renderStateTag({ data: { matchedRule } }) {
        return <RuleState rule={matchedRule} isCreating={false} isDeleting={false} />;
      },
      size: '160px',
    },
    {
      id: 'name',
      label: 'Name',
      renderCell: function renderName({ data: { matchedRule } }) {
        return matchedRule.name;
      },
      size: '250px',
    },
    {
      id: 'summary',
      label: 'Summary',
      renderCell: function renderSummary({ data: { matchedRule } }) {
        return matchedRule.annotations[Annotation.summary] ?? '';
      },
      size: '400px',
    },
  ];
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    max-width: ${theme.breakpoints.values.lg}px;
  `,
  moreMatches: css`
    margin-top: ${theme.spacing(1)};
  `,
  title: css`
    display: flex;
    align-items: center;
  `,
  badge: css`
    margin-left: ${theme.spacing(1)};
  `,
});
