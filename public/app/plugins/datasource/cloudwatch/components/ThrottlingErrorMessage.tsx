import React, { FunctionComponent } from 'react';

export interface Props {
  region: string;
}

export const ThrottlingErrorMessage: FunctionComponent<Props> = ({ region }) => (
  <p>
    Please visit the&nbsp;
    <a
      target="_blank"
      className="text-link"
      href={`https://${region}.console.aws.amazon.com/servicequotas/home?region=${region}#!/services/monitoring/quotas/L-5E141212`}
    >
      AWS Service Quotas console
    </a>
    &nbsp;to request a quota increase or see our&nbsp;
    <a
      target="_blank"
      className="text-link"
      href={`https://grafana.com/docs/features/datasources/cloudwatch/#service-quotas`}
    >
      documentation
    </a>
    &nbsp;to learn more.
  </p>
);
