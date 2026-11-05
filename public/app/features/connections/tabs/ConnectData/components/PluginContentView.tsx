import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { CardGrid, type CardGridItem } from '../CardGrid/CardGrid';
import { CategoryHeader } from '../CategoryHeader/CategoryHeader';

import { CloudProviderCards, DS_ONBOARDING_PLUGIN_ID, useShowCloudProviderCards } from './CloudProviderCards';

const getStyles = (theme: GrafanaTheme2) => ({
  spacer: css({
    height: theme.spacing(2),
  }),
});

export interface PluginContentViewProps {
  groupBy: string;
  datasourceCardGridItems: CardGridItem[];
  appsCardGridItems: CardGridItem[];
  pluginsByCategory: Array<{ label: string; items: CardGridItem[] }>;
  searchTerm?: string;
  onClickCardGridItem: (e: React.MouseEvent<HTMLElement>, item: CardGridItem) => void;
}

export function PluginContentView({
  groupBy,
  datasourceCardGridItems,
  appsCardGridItems,
  pluginsByCategory,
  searchTerm,
  onClickCardGridItem,
}: PluginContentViewProps) {
  const styles = useStyles2(getStyles);
  const hasOnboardingApp = useShowCloudProviderCards(searchTerm ?? '');

  if (groupBy === 'type') {
    return (
      <>
        {datasourceCardGridItems.length > 0 && (
          <>
            <CategoryHeader
              iconName="database"
              label={t('connections.connect-data.datasources-header', 'Data Sources')}
            />
            <CardGrid items={datasourceCardGridItems} onClickItem={onClickCardGridItem} />
          </>
        )}

        {(appsCardGridItems.length > 0 || hasOnboardingApp) && (
          <>
            <div className={styles.spacer} />
            <CategoryHeader iconName="apps" label={t('connections.connect-data.apps-header', 'Apps')} />
            {hasOnboardingApp && (
              <>
                <CloudProviderCards searchTerm={searchTerm} />
                <div className={styles.spacer} />
              </>
            )}
            <CardGrid
              items={appsCardGridItems.filter((item) => item.id !== DS_ONBOARDING_PLUGIN_ID)}
              onClickItem={onClickCardGridItem}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      {pluginsByCategory.map(({ label, items }, index) => (
        <div key={label}>
          {index > 0 && <div className={styles.spacer} />}
          <CategoryHeader label={label} />
          <CardGrid items={items} onClickItem={onClickCardGridItem} />
        </div>
      ))}
    </>
  );
}
