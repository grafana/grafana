import React, { FC, Fragment, useState } from 'react';
import { dateMath, GrafanaTheme, toDuration } from '@grafana/data';
import { css } from '@emotion/css';
import { Silence, SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';
import { AlertLabel } from '../AlertLabel';
import { StateTag } from '../StateTag';
import { CollapseToggle } from '../CollapseToggle';
import { useRulesByMatcher } from '../../hooks/useRulesByMatcher';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { CombinedRule } from 'app/types/unified-alerting';
import { useStyles } from '@grafana/ui';

interface Props {
  className?: string;
  silence: Silence;
}

const SilenceTableRow: FC<Props> = ({ silence, className }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  const styles = useStyles(getStyles);
  const { status, matchers, startsAt, endsAt, comment, createdBy } = silence;
  const rulesNamespaces = useRulesByMatcher(matchers as SilenceMatcher[]);
  const matchingRules = rulesNamespaces.reduce((ruleAcc, { groups }) => {
    groups.forEach(({ rules }) => {
      rules.forEach((rule) => {
        ruleAcc.push({ ...rule });
      });
    });

    return ruleAcc;
  }, [] as CombinedRule[]);
  const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
  const startsAtDate = dateMath.parse(startsAt);
  const endsAtDate = dateMath.parse(endsAt);
  const duration = toDuration(endsAtDate?.diff(startsAtDate || '')).humanize();

  return (
    <Fragment>
      <tr className={className}>
        <td>
          <CollapseToggle isCollapsed={isCollapsed} onToggle={(value) => setIsCollapsed(value)} />
        </td>
        <td>
          <StateTag status={status.state}>{status.state}</StateTag>
        </td>
        <td className={styles.matchersCell}>
          {matchers?.map(({ name, value }) => {
            return <AlertLabel key={`${name}-${value}`} labelKey={name} value={value} />;
          })}
        </td>
        <td>{matchingRules.length}</td>
        <td>
          {startsAtDate?.format(dateDisplayFormat)} {'-'}
          <br />
          {endsAtDate?.format(dateDisplayFormat)}
        </td>
        <td className={styles.actionsCell}>
          {status.state === 'expired' ? (
            <ActionButton icon="sync">Recreate</ActionButton>
          ) : (
            <ActionButton icon="bell">Unsilence</ActionButton>
          )}
          <ActionIcon icon="pen" tooltip="edit" />
          <ActionIcon icon="trash-alt" tooltip="delete" />
        </td>
      </tr>
      {!isCollapsed && (
        <>
          <tr className={className}>
            <td />
            <td>Comment</td>
            <td colSpan={4}>{comment}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Schedule</td>
            <td colSpan={4}>{`${startsAtDate?.format(dateDisplayFormat)} - ${endsAtDate?.format(
              dateDisplayFormat
            )}`}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Duration</td>
            <td colSpan={4}>{duration}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Created by</td>
            <td colSpan={4}>{createdBy}</td>
          </tr>
          {matchingRules.length > 0 && (
            <tr className={className}>
              <td />
              <td>Affected alert rules</td>
              <td colSpan={4}>
                <pre>{JSON.stringify(matchingRules, null, 2)}</pre>
              </td>
            </tr>
          )}
        </>
      )}
    </Fragment>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  matchersCell: css`
    & > * + * {
      margin-left: ${theme.spacing.xs};
    }
  `,
  actionsCell: css`
    text-align: right;
    width: 1%;
    white-space: nowrap;

    & > * + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
});

export default SilenceTableRow;
