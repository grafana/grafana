import { Suspense, lazy } from 'react';

import { type SupportedView } from '../../components/rules/Filter/RulesViewModeSelector';

const RulesFilterV2 = lazy(() => import('./RulesFilter.v2'));

export interface RulesFilterProps {
  onClear?: () => void;
  viewMode?: SupportedView;
  onViewModeChange?: (viewMode: SupportedView) => void;
}

const RulesFilter = (props: RulesFilterProps) => {
  return (
    <Suspense>
      <RulesFilterV2 {...props} />
    </Suspense>
  );
};

export default RulesFilter;
