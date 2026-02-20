import { css } from '@emotion/css';
import classNames from 'classnames';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DashboardLink } from '@grafana/schema';
import { CollapsableSection, Icon, Stack, TagList, Tooltip, useStyles2, Text } from '@grafana/ui';

import { getPluginNameForControlSource } from '../../utils/dashboardControls';

type Props = {
  links: DashboardLink[];
};

export function SystemLinksSection({ links }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <CollapsableSection label={<SystemLinksSectionLabel />} isOpen={isOpen} onToggle={setIsOpen}>
        <table className={classNames('filter-table', 'filter-table--hover', styles.table)} role="grid">
          <thead>
            <tr>
              <th>
                <Trans i18nKey="dashboard-scene.dashboard-link-list.type">Type</Trans>
              </th>
              <th>
                <Trans i18nKey="dashboard-scene.dashboard-link-list.info">Info</Trans>
              </th>
              <th className={styles.thNarrow} />
            </tr>
          </thead>
          <tbody>
            {links.map((link, index) => {
              const pluginName = getPluginNameForControlSource(link.source);

              return (
                <tr key={`${link.title}-${index}-default`}>
                  <td role="gridcell" className={styles.typeCell}>
                    <Icon name="external-link-alt" /> &nbsp; {link.type}
                  </td>
                  <td role="gridcell" className={styles.infoCell}>
                    <Stack>
                      {link.title && <span className={styles.titleWrapper}>{link.title}</span>}
                      {link.type === 'link' && link.url && <span className={styles.urlWrapper}>{link.url}</span>}
                      {link.type === 'dashboards' && <TagList tags={link.tags ?? []} />}
                    </Stack>
                  </td>
                  <td role="gridcell" className={styles.sourceCell}>
                    <Tooltip content={getSourceTooltip(pluginName)}>
                      <Icon name="database" className={styles.iconMuted} aria-hidden />
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CollapsableSection>
    </div>
  );
}

function getSourceTooltip(pluginName: string | undefined): string {
  return pluginName
    ? t('dashboard-scene.default-links-table.added-by-datasource', "Added by the '{{pluginName}}' plugin", {
        pluginName,
      })
    : t('dashboard-scene.default-links-table.added-by-datasource-unknown', 'Added by datasource');
}

function SystemLinksSectionLabel() {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Text element="h5">
        <Trans i18nKey="dashboard-scene.default-links-table.heading">System links</Trans>
      </Text>
      <Tooltip
        content={t(
          'dashboard-scene.default-links-table.heading-tooltip',
          'These links are provided by the system and cannot be edited.'
        )}
      >
        <Icon name="info-circle" className={styles.iconMuted} aria-hidden />
      </Tooltip>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: theme.spacing(4),
    paddingTop: theme.spacing(4),
  }),
  iconMuted: css({
    color: theme.colors.text.secondary,
  }),
  table: css({
    overflow: 'auto',
  }),
  thNarrow: css({
    width: '1%',
  }),
  typeCell: css({
    width: '1%',
    verticalAlign: 'top',
    color: theme.colors.text.maxContrast,
  }),
  infoCell: css({
    width: '100%',
  }),
  titleWrapper: css({
    display: 'block',
    maxWidth: theme.spacing(50),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  urlWrapper: css({
    display: 'block',
    maxWidth: theme.spacing(75),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  sourceCell: css({
    width: '1%',
  }),
});
