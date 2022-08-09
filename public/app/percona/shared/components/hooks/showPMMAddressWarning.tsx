import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { getPerconaSettings } from '../../core/selectors';

export const useShowPMMAddressWarning = () => {
  const { result: settings, loading } = useSelector(getPerconaSettings);
  const showMonitoringWarning = useMemo(() => loading || !settings?.publicAddress, [settings?.publicAddress, loading]);

  return [showMonitoringWarning];
};
