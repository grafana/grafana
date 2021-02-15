import { useMemo } from 'react';
import { useObservable } from 'react-use';
import { PanelData } from '@grafana/data';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';

export const getData = (queryRunner: PanelQueryRunner) => {
  const observable = useMemo(() => queryRunner.getData({ withFieldConfig: true, withTransforms: true }), []);
  return useObservable<PanelData>(observable);
};
