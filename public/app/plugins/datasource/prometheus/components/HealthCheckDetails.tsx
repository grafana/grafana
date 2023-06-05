import React from 'react';

import { HealthCheckDetailsProps } from '@grafana/data';
import { Badge, BadgeColor, Tooltip } from '@grafana/ui';
import { PromApiFeatures, PromApplication } from 'app/types/unified-alerting-dto';

function HealthCheckDetails({ details }: HealthCheckDetailsProps<PromApiFeatures>) {
  const enabled = <Badge color="green" icon="check" text="Ruler API enabled" />;
  const disabled = <Badge color="orange" icon="exclamation-triangle" text="Ruler API not enabled" />;
  const unsupported = (
    <Tooltip
      placement="top"
      content="Prometheus does not allow editing rules, connect to either a Mimir or Cortex datasource to manage alerts via Grafana."
    >
      <div>
        <Badge color="red" icon="exclamation-triangle" text="Ruler API not supported" />
      </div>
    </Tooltip>
  );

  const LOGOS = {
    [PromApplication.Cortex]: '/public/app/plugins/datasource/prometheus/img/cortex_logo.svg',
    [PromApplication.Mimir]: '/public/app/plugins/datasource/prometheus/img/mimir_logo.svg',
    [PromApplication.Prometheus]: '/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg',
    [PromApplication.Thanos]: '/public/app/plugins/datasource/prometheus/img/thanos_logo.svg',
  };

  const COLORS: Record<PromApplication, BadgeColor> = {
    [PromApplication.Cortex]: 'blue',
    [PromApplication.Mimir]: 'orange',
    [PromApplication.Prometheus]: 'red',
    [PromApplication.Thanos]: 'purple',
  };

  const AppDisplayNames: Record<PromApplication, string> = {
    [PromApplication.Cortex]: 'Cortex',
    [PromApplication.Mimir]: 'Mimir',
    [PromApplication.Prometheus]: 'Prometheus',
    [PromApplication.Thanos]: 'Thanos',
  };

  const application = details.application;
  const logo = application && LOGOS[application];

  // this will inform the user about what "subtype" the datasource is; Mimir, Cortex or vanilla Prometheus
  const applicationSubType = (
    <Badge
      text={
        <span>
          {logo && <img style={{ width: 14, height: 14, verticalAlign: 'text-bottom' }} src={logo} alt={application} />}{' '}
          {application ? AppDisplayNames[application] : 'Unknown'}
        </span>
      }
      color={COLORS[application ?? PromApplication.Prometheus]}
    />
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'max-content max-content',
        rowGap: '0.5rem',
        columnGap: '2rem',
        marginTop: '1rem',
      }}
    >
      <div>Type</div>
      <div>{applicationSubType}</div>
      <>
        <div>Ruler API</div>
        {/* Prometheus does not have a Ruler API – so show that it is not supported */}
        {details.application === PromApplication.Prometheus && <div>{unsupported}</div>}
        {details.application !== PromApplication.Prometheus && (
          <div>{details.features.rulerApiEnabled ? enabled : disabled}</div>
        )}
      </>
    </div>
  );
}

export { HealthCheckDetails };
