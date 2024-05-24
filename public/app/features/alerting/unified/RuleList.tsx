import React, { Suspense } from 'react';

import { config } from '@grafana/runtime';

import RuleListV1 from './components/rule-list/RuleList.v1';
const RuleListV2 = React.lazy(() => import('./components/rule-list/RuleList.v2'));

const RuleList = () => {
  const newView = config.featureToggles.alertingListViewV2;

  return <Suspense>{newView ? <RuleListV2 /> : <RuleListV1 />}</Suspense>;
};

export default RuleList;
