import React from 'react';
import { css } from 'emotion';
import { compare, Operation } from 'fast-json-patch';
import jsonMap from 'json-source-map';
import _ from 'lodash';

import { Button, HorizontalGroup } from '@grafana/ui';
import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';
import { DiffGroup } from './DiffGroup';
import { DiffViewer } from './DiffViewer';

type DiffViewProps = {
  isNewLatest: boolean;
  newInfo: DecoratedRevisionModel;
  baseInfo: DecoratedRevisionModel;
  versions?: { lhs: Object; rhs: Object };
  onFetchFail: () => void;
};

export const VersionHistoryComparison = ({ baseInfo, newInfo, versions, isNewLatest, onFetchFail }: DiffViewProps) => {
  if (!versions) {
    return null;
  }
  const basicDiff = jsonDiff(versions.lhs, versions.rhs);

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
        {Object.entries(basicDiff).map(([key, diffs]) => (
          <DiffGroup diffs={diffs} key={key} title={key} />
        ))}
      </div>

      <DiffViewer original={JSON.stringify(versions.lhs, null, 2)} value={JSON.stringify(versions.rhs, null, 2)} />

      <div className="gf-form-button-row">
        <Button variant="secondary" onClick={() => console.log(basicDiff)}>
          View JSON Diff
        </Button>
      </div>
    </div>
  );
};

const jsonDiff = (lhs: Object, rhs: Object) => {
  const diffs = compare(lhs, rhs);
  const lhsMap = jsonMap.stringify(lhs, null, 2);
  const rhsMap = jsonMap.stringify(rhs, null, 2);

  const getDiffInformation = (diffs: Operation[]) =>
    diffs.map((diff) => {
      let originalValue = undefined;
      let value = undefined;
      let startLineNumber = 0;

      const path = _.tail(diff.path.split('/'));
      if (diff.op === 'replace') {
        originalValue = _.get(lhs, path);
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'add') {
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'remove') {
        originalValue = _.get(lhs, path);
        console.log(_.head(diff.path));
        startLineNumber = lhsMap.pointers[diff.path].value.line;
      }

      return {
        op: diff.op,
        value,
        path,
        originalValue,
        startLineNumber,
      };
    });

  const sortByLineNumber = (diffs) => _.sortBy(diffs, 'startLineNumber');
  const groupByPath = (diffs) =>
    diffs.reduce((acc, value) => {
      const groupKey: string = _.first(value.path) || 'group';
      const itemKey: string = value.path[1] || '0';
      if (!acc[groupKey]) {
        acc[groupKey] = {};
      }
      if (!acc[groupKey][itemKey]) {
        acc[groupKey][itemKey] = [];
      }
      acc[groupKey][itemKey].push(value);
      return acc;
    }, {});

  return _.flow([getDiffInformation, sortByLineNumber, groupByPath])(diffs);
};
