import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2, withErrorBoundary } from '@grafana/ui';
import { RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { getAllRulesSourcesIdentifiers } from '../../utils/datasource';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import RulesFilter from '../rules/Filter/RulesFilter';

import { DataSourceIcon } from './Namespace';

// const noop = () => {};

const RuleList = withErrorBoundary(
  () => {
    const dataSourceIdentifiers = getAllRulesSourcesIdentifiers();

    return (
      // We don't want to show the Loading... indicator for the whole page.
      // We show separate indicators for Grafana-managed and Cloud rules
      <AlertingPageWrapper navId="alert-list" isLoading={false} actions={null}>
        <RulesFilter onClear={() => {}} />
        <Stack direction="column" gap={1}>
          {dataSourceIdentifiers.map((identifier) => (
            <DataSourceLoader key={identifier.uid} uid={identifier.uid} />
          ))}
          {/* <DataSourceSection name="Grafana" application={'grafana'}>
            <ListSection title="Namespace">
              <ListGroup name={'Group'} onToggle={noop}>
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
              </ListGroup>
              <ListGroup name={'Group 2'} onToggle={noop}>
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
              </ListGroup>
            </ListSection>
            <ListSection title="Namespace 2">
              <ListGroup name={'Group'} onToggle={noop}>
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
                <AlertRuleListItem name={'My rule'} href={''} />
              </ListGroup>
            </ListSection>
            <Pagination currentPage={1} numberOfPages={0} onNavigate={noop} />
          </DataSourceSection>

          <DataSourceSection name="Mimir Data Source" application={PromApplication.Mimir}>
            <ListSection title="Namespace">
              <ListGroup name={'Group'} onToggle={noop}>
                <AlertRuleListItem name={'My rule'} href={''} />
              </ListGroup>
            </ListSection>
          </DataSourceSection>

          <DataSourceSection name="Loki Data Source" application="loki">
            <ListSection title="Namespace">
              <ListGroup name={'Group'} onToggle={noop}>
                <AlertRuleListItem name={'My rule'} href={''} />
              </ListGroup>
            </ListSection>
          </DataSourceSection> */}
        </Stack>
      </AlertingPageWrapper>
    );
  },
  { style: 'page' }
);

interface DataSourceSectionProps extends PropsWithChildren {
  name?: string;
  loader?: ReactNode;
  application?: RulesSourceApplication;
}

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

interface DataSourceLoaderProps {
  uid: string;
}

const DataSourceLoader = ({ uid }: DataSourceLoaderProps) => {
  // 1. grab BuildInfo
  const { data: dataSourceInfo, isLoading } = useDiscoverDsFeaturesQuery({ uid });
  if (isLoading) {
    return <DataSourceSection loader={<Skeleton width={250} height={8} />} />;
  }

  if (dataSourceInfo) {
    const name = dataSourceInfo.dataSourceSettings.name;
    const application = dataSourceInfo.features.application;

    // 2. grab prometheus rule groups with max_groups if supported

    return <DataSourceSection name={name} application={application}></DataSourceSection>;
  }

  return null;
};

const DataSourceSection = ({ name, application, children, loader }: DataSourceSectionProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.dataSourceSection}>
      <div className={styles.dataSourceSectionTitle}>
        {loader ?? (
          <Stack alignItems="center">
            {application && <DataSourceIcon application={application} />}
            {name && (
              <Text variant="body" weight="bold">
                {name}
              </Text>
            )}
          </Stack>
        )}
      </div>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  dataSourceSection: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    border: `solid 1px ${theme.colors.border.weak}`,
    padding: `${theme.spacing(0)} ${theme.spacing(0)}`,
    borderRadius: theme.shape.radius.default,
  }),
  dataSourceSectionTitle: css({
    background: theme.colors.background.secondary,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    // border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});

export default RuleList;
