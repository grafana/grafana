import { ServiceAccountDTO } from 'app/types/serviceaccount';

import { ServiceAccountPermissions } from './ServiceAccountPermissions';

interface Props {
  serviceAccount: ServiceAccountDTO;
}

export const ServiceAccountManagementPage = ({ serviceAccount }: Props) => {
  return (
    <div>
      <ServiceAccountPermissions serviceAccount={serviceAccount} />
    </div>
  );
};
