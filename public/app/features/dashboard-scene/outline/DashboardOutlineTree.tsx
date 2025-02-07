import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { DashboardOutlineTreeItem } from './DashboardOutlineTreeItem';
import { DashboardOutlineItem } from './types';

interface Props {
  items: DashboardOutlineItem[];
  id?: string;
}

export function DashboardOutlineTree({ items, id }: Props) {
  const styles = useStyles2(getStyles, id);

  return (
    <div id={id} role={id ? 'group' : 'tree'} className={styles.container}>
      {items.map((item) => (
        <DashboardOutlineTreeItem
          item={item}
          key={`${item.item.state.key}-${'children' in item ? item.children.length : 0}`}
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, id?: string) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    marginLeft: id ? theme.spacing(1) : 0,
    paddingLeft: id ? theme.spacing(2) : 0,
    borderLeft: id ? `1px solid ${theme.colors.border.strong}` : 'none',
  }),
});
