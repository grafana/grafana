import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import _ from 'lodash';
import { Icon, useStyles, useTheme } from '@grafana/ui';
import { Diff } from 'deep-diff';
import { DashboardModel } from '../../state';

type ChangeKind = 'E' | 'N' | 'D' | 'A';

type Props = {
  changes: Array<Diff<DashboardModel>>;
  title: string;
};

const getChangeColor = (changeKind: ChangeKind): string => {
  if (changeKind === 'E') {
    return 'edited';
  }
  if (changeKind === 'D') {
    return 'deleted';
  }
  return 'added';
};

const getChangeText = (changeKind: ChangeKind): string => {
  if (changeKind === 'E') {
    return 'changed';
  }
  if (changeKind === 'D') {
    return 'deleted';
  }
  return 'added';
};

export const VersionHistoryBlock: React.FC<Props> = ({ changes, title }) => {
  const styles = useStyles(getStyles);

  if (changes.length === 1) {
    return (
      <div className={styles.group}>
        <Icon type="mono" name="circle" className={getChangeColor(changes[0].kind)} />{' '}
        <span className={styles.title}>{title}</span> <span>{getChangeText(changes[0].kind)}</span>{' '}
        <VersionHistoryDiff leftValue={changes[0].lhs} rightValue={changes[0].rhs} />
      </div>
    );
  }

  return (
    <dl className={styles.group}>
      <dt className={styles.spacer}>
        <Icon type="mono" name="circle" className={getChangeColor('E')} /> <span className={styles.title}>{title}</span>{' '}
        <span>{getChangeText('E')}</span>
      </dt>
      {changes.map(
        (change, idx: number): React.ReactNode => {
          const path = change.path[change.path.length - 1];
          return (
            <dd className={change.kind === 'A' ? styles.arrayItem : styles.item} key={`${path}_${idx}`}>
              {change.kind === 'A' ? (
                <span>
                  <Icon name="circle" className={getChangeColor(change.item.kind)} /> list{' '}
                  {getChangeText(change.item.kind)}
                </span>
              ) : (
                <span>
                  {getChangeText(change.kind)} {path}{' '}
                  <VersionHistoryDiff leftValue={change.lhs} rightValue={change.rhs} />
                </span>
              )}
            </dd>
          );
        }
      )}
    </dl>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  group: css`
    background-color: ${theme.colors.bg2};
    font-size: ${theme.typography.size.md};
    margin-bottom: ${theme.spacing.md};
    padding: ${theme.spacing.md};
  `,
  arrayItem: css`
    margin-bottom: ${theme.spacing.md};
    margin-left: 12px;
  `,
  item: css`
    display: list-item;
    list-style: disc;
    margin-bottom: ${theme.spacing.md};
    margin-left: ${theme.spacing.xl};
  `,
  title: css`
    font-weight: ${theme.typography.weight.bold};
  `,
  spacer: css`
    margin-bottom: ${theme.spacing.md};
  `,
  added: css`
    color: ${theme.palette.online};
  `,
  edited: css`
    color: ${theme.palette.warn};
  `,
  deleted: css`
    color: ${theme.palette.critical};
  `,
});

const VersionHistoryDiff = ({ leftValue, rightValue }: { leftValue: any; rightValue: any }) => {
  const theme = useTheme();
  const hasLeftValue = !_.isNil(leftValue) || !_.isUndefined(leftValue);
  const hasRightValue = !_.isNil(rightValue) || !_.isUndefined(rightValue);
  const tagClass = css`
    background-color: ${theme.colors.bg3};
    border-radius: ${theme.border.radius.md};
    color: ${theme.colors.textHeading};
    font-size: ${theme.typography.size.base};
    margin: 0 ${theme.spacing.xs};
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
  `;

  return (
    <>
      {hasLeftValue && <span className={tagClass}>{leftValue.toString()}</span>}
      {hasLeftValue && hasRightValue ? <Icon name="arrow-right" /> : null}
      {hasRightValue && <span className={tagClass}>{rightValue.toString()}</span>}
    </>
  );
};
