import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { CardGrid, type CardGridItem } from '../CardGrid/CardGrid';
import { CategoryHeader } from '../CategoryHeader/CategoryHeader';

import { type ConnectionEntryPoints } from './ConnectionEntryPoints';

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
  entryPoints: ConnectionEntryPoints;
  onClickCardGridItem: (e: React.MouseEvent<HTMLElement>, item: CardGridItem) => void;
}

export function PluginContentView({
  groupBy,
  datasourceCardGridItems,
  appsCardGridItems,
  pluginsByCategory,
  entryPoints,
  onClickCardGridItem,
}: PluginContentViewProps) {
  const styles = useStyles2(getStyles);

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

        {(appsCardGridItems.length > 0 || entryPoints.hasVisibleEntryPoints) && (
          <>
            <div className={styles.spacer} />
            <CategoryHeader iconName="apps" label={t('connections.connect-data.apps-header', 'Apps')} />
          </>
        )}
        {entryPoints.element}
        {entryPoints.hasVisibleEntryPoints && appsCardGridItems.length > 0 && <div className={styles.spacer} />}
        {appsCardGridItems.length > 0 && (
          <CardGrid
            items={appsCardGridItems.filter((item) => !entryPoints.pluginIds.has(item.id))}
            onClickItem={onClickCardGridItem}
          />
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
