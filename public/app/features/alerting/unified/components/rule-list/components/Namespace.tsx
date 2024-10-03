import { PropsWithChildren, ReactNode } from 'react';

import { Icon, Stack } from '@grafana/ui';
import { PromApplication } from 'app/types/unified-alerting-dto';

import { ListSection } from './ListSection';

interface NamespaceSectionProps extends PropsWithChildren {
  name: string;
  application: PromApplication | 'Grafana';
  actions: ReactNode;
  collapsed?: boolean;
}

export const Namespace = ({
  name,
  application,
  actions = null,
  collapsed = false,
  children,
}: NamespaceSectionProps) => {
  return (
    <ListSection
      title={
        <Stack direction="row" alignItems="center">
          {application === PromApplication.Prometheus && (
            <img
              width={16}
              height={16}
              src="/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg"
              alt="Prometheus"
            />
          )}
          {application === PromApplication.Mimir && (
            <img
              width={16}
              height={16}
              src="/public/app/plugins/datasource/prometheus/img/mimir_logo.svg"
              alt="Mimir"
            />
          )}
          {application === 'Grafana' && <Icon name="folder" />}
          {name}
        </Stack>
      }
      actions={actions}
      collapsed={collapsed}
    >
      {children}
    </ListSection>
  );
};
