import { CheckDetails } from 'app/percona/check/types';

export interface CheckActionsProps {
  check: CheckDetails;
  onChangeCheck: (check: CheckDetails) => Promise<any>;
  onIntervalChangeClick: (check: CheckDetails) => void;
  onIndividualRunCheckClick: (check: CheckDetails) => Promise<any>;
}
