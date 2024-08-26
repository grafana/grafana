import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const CHEAT_SHEET_ITEMS = [
  {
    title: 'Getting started',
    label:
      'Start by selecting a measurement and field from the dropdown above. You can then use the tag selector to further narrow your search.',
  },
];

export const InfluxCheatSheet = () => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h2>InfluxDB Cheat Sheet</h2>
      {CHEAT_SHEET_ITEMS.map((item) => (
        <div className={styles.cheatSheetItem} key={item.title}>
          <div className={styles.cheatSheetItemTitle}>{item.title}</div>
          {item.label}
        </div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  cheatSheetItem: css({
    margin: theme.spacing(3, 0),
  }),
  cheatSheetItemTitle: css({
    fontSize: theme.typography.h3.fontSize,
  }),
});
