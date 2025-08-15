import { Suspense, lazy } from 'react';

import { config } from '@grafana/runtime';

import RulesFilterV1 from './RulesFilter.v1';
import { SupportedView } from './RulesViewModeSelector';

const RulesFilterV2 = lazy(() => import('../../../rule-list/filter/RulesFilter.v2'));

export interface RulesFilterProps {
  onClear?: () => void;
  viewMode?: SupportedView;
  onViewModeChange?: (viewMode: SupportedView) => void;
}

const RulesFilter = (props: RulesFilterProps) => {
  const newView = config.featureToggles.alertingFilterV2;
  return <Suspense>{newView ? <RulesFilterV2 {...props} /> : <RulesFilterV1 {...props} />}</Suspense>;
};

export default RulesFilter;
