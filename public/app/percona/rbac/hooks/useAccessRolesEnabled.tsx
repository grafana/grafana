import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

export const useAccessRolesEnabled = (): boolean => {
  const { result: settings } = useSelector(getPerconaSettings);
  return !!settings?.enableAccessControl;
};
