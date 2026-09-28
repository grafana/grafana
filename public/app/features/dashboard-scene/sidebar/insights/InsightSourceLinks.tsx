import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { type InsightSourcePanel } from './sources';

interface Props {
  /** Keys to show, with a fallback title for panels that are no longer on the dashboard */
  items: Array<{ key: string; title: string }>;
  sources: InsightSourcePanel[];
}

export function InsightSourceLinks({ items, sources }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.list}>
      {items.map(({ key, title }) => {
        const source = sources.find((candidate) => candidate.key === key);
        return (
          <li key={key}>
            {source ? (
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                icon="eye"
                tooltip={t('dashboard.insights.sources.view-panel', 'View panel')}
                onClick={() => locationService.partial({ viewPanel: source.panel.getPathId() })}
              >
                {source.title}
              </Button>
            ) : (
              <Text variant="bodySmall" color="secondary">
                {t('dashboard.insights.sources.unavailable', '{{title}} (unavailable)', { title })}
              </Text>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      listStyle: 'none',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
  };
}
