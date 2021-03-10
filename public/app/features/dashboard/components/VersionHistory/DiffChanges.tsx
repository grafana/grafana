import React from 'react';
import _ from 'lodash';
import { Button } from '@grafana/ui';
import { Change } from './DiffGroup';
import { DiffSummary, getChangeText } from './DiffSummary';
import { DiffValues } from './DiffValues';

type DiffChangesProps = {
  identifier: string;
  diffs: Change[];
};

export const DiffChanges: React.FC<DiffChangesProps> = ({ diffs, identifier }) => {
  return (
    <>
      {parseInt(identifier, 10) >= 0 && <DiffSummary name={`Item ${identifier}`} operation={'replace'} />}
      <ul style={{ marginLeft: 20 }}>
        {diffs.map((diff: Change, idx: number) => {
          return (
            <li
              style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, marginLeft: 8 }}
              key={`${_.last(diff.path)}__${idx}`}
            >
              <span>
                <span>{getChangeText(diff.op)}</span> {_.isArray(diff.value) && <span>{diff.value.length}</span>}{' '}
                {_.isArray(diff.originalValue) && <span>{diff.originalValue.length}</span>}{' '}
                <span>{_.last(diff.path)}</span> <DiffValues change={diff} />
              </span>
              <Button size="sm" variant="secondary">
                Go to ln:{diff.startLineNumber}
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
};
