import React from 'react';
import _ from 'lodash';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { DiffTitle } from './DiffTitle';
import { DiffSummary } from './DiffSummary';
import { DiffChanges } from './DiffChanges';

export type Change = {
  op: 'add' | 'replace' | 'remove';
  value: any;
  originalValue: any;
  path: string[];
  startLineNumber: number;
};

type DiffGroupProps = {
  diffs: {
    [key: string]: Change[];
  };
  title: string;
};

export const DiffGroup: React.FC<DiffGroupProps> = ({ diffs, title }) => {
  const styles = useStyles(getStyles);
  const itemKeys = Object.keys(diffs);
  const singleChange = itemKeys.length === 1 && diffs[itemKeys[0]].length === 1;

  if (singleChange) {
    return (
      <div className={styles}>
        <DiffTitle title={title} diff={diffs[itemKeys[0]][0]} />
      </div>
    );
  }

  return (
    <div className={styles}>
      <DiffTitle title={title} />
      {itemKeys.map((key) => {
        if (diffs[key].length > 6) {
          return <DiffSummary name={`Item ${key} has multiple edits`} operation={'replace'} />;
        }
        // TODO: handle this betterer - a basic array of values matches multiple times.
        if (diffs[key].length === 1) {
          return <DiffSummary name={parseInt(key, 10) >= 0 ? `Item ${key}` : ''} operation={diffs[key][0].op} />;
        }
        // TODO: put this in <DiffChange />
        return <DiffChanges diffs={diffs[key]} identifier={key} key={key} />;
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => css`
  background-color: ${theme.colors.bg2};
  font-size: ${theme.typography.size.md};
  margin-bottom: ${theme.spacing.md};
  padding: ${theme.spacing.md};
`;
