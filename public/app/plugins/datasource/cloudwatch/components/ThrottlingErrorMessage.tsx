import React from 'react';

export interface Props {
  region: string;
}

export const ThrottlingErrorMessage = ({ region }: Props) => (
  <p>
    Please visit the&nbsp;
    <a
      target="_blank"
      rel="noreferrer"
      className="text-link"
      href={`https://${region}.console.aws.amazon.com/servicequotas/home?region=${region}#!/services/monitoring/quotas/L-5E141212`}
    >
      AWS Service Quotas console
    </a>
    &nbsp;to request a quota increase or see our&nbsp;
    <a
      target="_blank"
      rel="noreferrer"
      className="text-link"
      href="https://grafana.com/docs/grafana/latest/datasources/cloudwatch/#service-quotas"
    >
      documentation
    </a>
    &nbsp;to learn more.
  </p>
);
