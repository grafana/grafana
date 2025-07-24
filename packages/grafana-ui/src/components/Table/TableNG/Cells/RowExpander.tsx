import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Icon } from '../../../Icon/Icon';
import { RowExpanderNGProps } from '../types';

export function RowExpander({ height, onCellExpand, isExpanded }: RowExpanderNGProps) {
  const styles = useStyles2(getStyles, height);
  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onCellExpand(e);
    }
  }
  return (
    <div role="button" tabIndex={0} className={styles.expanderCell} onClick={onCellExpand} onKeyDown={handleKeyDown}>
      <Icon
        aria-label={
          isExpanded
            ? t('grafana-ui.row-expander-ng.aria-label-collapse', 'Collapse row')
            : t('grafana-ui.row-expander.aria-label-expand', 'Expand row')
        }
        name={isExpanded ? 'angle-down' : 'angle-right'}
        size="lg"
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, rowHeight: number) => ({
  expanderCell: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: `${rowHeight}px`,
    cursor: 'pointer',
  }),
});
