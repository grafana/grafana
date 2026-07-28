import { Icon } from '@grafana/ui';
import mimirLogoSvg from 'app/plugins/datasource/prometheus/img/mimir_logo.svg';
import prometheusLogoSvg from 'app/plugins/datasource/prometheus/img/prometheus_logo.svg';
import { PromApplication, type RulesSourceApplication } from 'app/types/unified-alerting-dto';

import lokiIconSvg from '../../../../loki-helpers/loki_icon.svg';

interface DataSourceIconProps {
  application?: RulesSourceApplication;
  size?: number;
}

export const DataSourceIcon = ({ application, size = 16 }: DataSourceIconProps) => {
  switch (application) {
    case PromApplication.Prometheus:
      return <img width={size} height={size} src={prometheusLogoSvg} alt="Prometheus" />;
    case PromApplication.Mimir:
      return <img width={size} height={size} src={mimirLogoSvg} alt="Mimir" />;
    case 'Loki':
      return <img width={size} height={size} src={lokiIconSvg} alt="Loki" />;
    case 'grafana':
    default:
      return <Icon name="grafana" />;
  }
};
