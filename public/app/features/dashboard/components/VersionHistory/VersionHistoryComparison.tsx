import React from 'react';
import { css } from 'emotion';
import _ from 'lodash';
import DeepDiff from 'deep-diff';
import { Button, HorizontalGroup } from '@grafana/ui';
import { DashboardModel } from '../../state/DashboardModel';
import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';
import { VersionHistoryBlock } from './VersionHistoryBlock';

type DiffViewProps = {
  isNewLatest: boolean;
  newInfo: DecoratedRevisionModel;
  baseInfo: DecoratedRevisionModel;
  delta: { lhs: DashboardModel; rhs: DashboardModel };
  onFetchFail: () => void;
};

export const VersionHistoryComparison = ({ baseInfo, newInfo, delta, isNewLatest, onFetchFail }: DiffViewProps) => {
  const basicDiff = _.groupBy(DeepDiff.diff(delta.lhs, delta.rhs), (change) => change.path![0]);
  return (
    <div>
      <HorizontalGroup justify="space-between" align="center">
        <div>
          <p className="small muted">
            <strong>Version {newInfo.version}</strong> updated by
            <span>{newInfo.createdBy} </span>
            <span>{newInfo.ageString}</span>
            <span> - {newInfo.message}</span>
          </p>
          <p className="small muted">
            <strong>Version {baseInfo.version}</strong> updated by
            <span>{baseInfo.createdBy} </span>
            <span>{baseInfo.ageString}</span>
            <span> - {baseInfo.message}</span>
          </p>
        </div>
        {isNewLatest && (
          <Button variant="destructive" onClick={() => console.log('restore')} icon="history">
            Restore to version {baseInfo.version}
          </Button>
        )}
      </HorizontalGroup>

      <div
        className={css`
          padding-top: 16px;
        `}
      >
        {Object.entries(basicDiff).map(([key, value]) => (
          <VersionHistoryBlock changes={value} key={key} title={key} />
        ))}
      </div>

      <div className="gf-form-button-row">
        <Button variant="secondary" onClick={() => console.log({ basicDiff, lhs: delta.lhs, rhs: delta.rhs })}>
          View JSON Diff
        </Button>
      </div>
    </div>
  );
};
