import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type DataSourceSettings, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, CollapsableSection, LinkButton, Stack, Tag, useStyles2 } from '@grafana/ui';

import { ROUTES } from '../../connections/constants';
import { useDataSourceHealth } from '../state/useDataSourceHealth';

import { DataSourcesListCard } from './DataSourcesListCard';

const INSTANCES_PREVIEW_COUNT = 5;

export interface PluginGroup {
  type: string;
  typeName: string;
  typeLogoUrl: string;
  hasDefault: boolean;
  dataSources: DataSourceSettings[];
}

export function groupDataSourcesByPlugin(dataSources: DataSourceSettings[]): PluginGroup[] {
  const groups = new Map<string, PluginGroup>();

  for (const ds of dataSources) {
    const existing = groups.get(ds.type);
    if (existing) {
      existing.dataSources.push(ds);
      existing.hasDefault = existing.hasDefault || ds.isDefault;
      if (!existing.typeLogoUrl && ds.typeLogoUrl) {
        existing.typeLogoUrl = ds.typeLogoUrl;
      }
    } else {
      groups.set(ds.type, {
        type: ds.type,
        typeName: ds.typeName || ds.type,
        typeLogoUrl: ds.typeLogoUrl,
        hasDefault: ds.isDefault,
        dataSources: [ds],
      });
    }
  }

  // Sorting a small, known dataset (the distinct plugin types the user has installed).
  // eslint-disable-next-line @grafana/no-locale-compare
  return Array.from(groups.values()).sort((a, b) => a.typeName.localeCompare(b.typeName));
}

export interface Props {
  dataSources: DataSourceSettings[];
  hasWriteRights: boolean;
  hasExploreRights: boolean;
}

export function DataSourcesPluginSections({ dataSources, hasWriteRights, hasExploreRights }: Props) {
  const groups = useMemo(() => groupDataSourcesByPlugin(dataSources), [dataSources]);

  return (
    <Stack direction="column" gap={1}>
      {groups.map((group) => (
        <PluginSection
          key={group.type}
          group={group}
          hasWriteRights={hasWriteRights}
          hasExploreRights={hasExploreRights}
        />
      ))}
    </Stack>
  );
}

interface PluginSectionProps {
  group: PluginGroup;
  hasWriteRights: boolean;
  hasExploreRights: boolean;
}

function PluginSection({ group, hasWriteRights, hasExploreRights }: PluginSectionProps) {
  const styles = useStyles2(getStyles);
  const count = group.dataSources.length;
  const previewItems = group.dataSources.slice(0, INSTANCES_PREVIEW_COUNT);
  const hasMore = count > INSTANCES_PREVIEW_COUNT;
  const moreHref = config.appSubUrl + ROUTES.DataSourcesByType.replace(/:type/gi, encodeURIComponent(group.type));

  const label = (
    <Stack direction="row" alignItems="center" gap={1}>
      <img src={group.typeLogoUrl} alt="" className={styles.logo} />
      <span className={styles.title}>{group.typeName}</span>
      <Badge text={String(count)} color="blue" />
      {group.hasDefault && <Tag name={t('datasources.plugin-sections.default', 'default')} colorIndex={1} />}
    </Stack>
  );

  return (
    <div className={styles.card}>
      <CollapsableSection label={label} isOpen={false} contentClassName={styles.content}>
        <Stack direction="column" gap={1}>
          <ul className={styles.list} aria-label={group.typeName}>
            {previewItems.map((dataSource) => (
              <li key={dataSource.uid}>
                <ConnectionRow
                  dataSource={dataSource}
                  hasWriteRights={hasWriteRights}
                  hasExploreRights={hasExploreRights}
                />
              </li>
            ))}
          </ul>
          {hasMore && (
            <Stack direction="row" justifyContent="flex-start">
              <LinkButton variant="secondary" fill="text" icon="arrow-right" href={moreHref}>
                {t('datasources.plugin-sections.more', 'View all {{count}} {{name}} data sources', {
                  count,
                  name: group.typeName,
                })}
              </LinkButton>
            </Stack>
          )}
        </Stack>
      </CollapsableSection>
    </div>
  );
}

interface ConnectionRowProps {
  dataSource: DataSourceSettings;
  hasWriteRights: boolean;
  hasExploreRights: boolean;
}

function ConnectionRow({ dataSource, hasWriteRights, hasExploreRights }: ConnectionRowProps) {
  const health = useDataSourceHealth(dataSource.uid);

  return (
    <DataSourcesListCard
      dataSource={dataSource}
      hasWriteRights={hasWriteRights}
      hasExploreRights={hasExploreRights}
      health={health}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(0.5)} ${theme.spacing(2)}`,
  }),
  logo: css({
    width: theme.spacing(3),
    height: theme.spacing(3),
    objectFit: 'contain',
  }),
  title: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  content: css({
    // Condense the gap between the section header and its content.
    padding: `${theme.spacing(0.5)} 0 ${theme.spacing(1)} 0`,
  }),
  list: css({
    listStyle: 'none',
    display: 'grid',
    gap: theme.spacing(1),
    padding: 0,
    margin: 0,
  }),
});
