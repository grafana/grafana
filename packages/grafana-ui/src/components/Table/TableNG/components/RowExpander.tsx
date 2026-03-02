import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Icon } from '../../../Icon/Icon';
import { RowExpanderNGProps } from '../types';

export function RowExpander({ onCellExpand, isExpanded, rowId }: RowExpanderNGProps) {
  const styles = useStyles2(getStyles);
  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onCellExpand(e);
    }
  }
  const label = isExpanded
    ? t('grafana-ui.row-expander-ng.aria-label-collapse', 'Collapse row')
    : t('grafana-ui.row-expander.aria-label-expand', 'Expand row');
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.expanderCell}
      onClick={onCellExpand}
      onKeyDown={handleKeyDown}
      aria-label={label}
      data-testid={selectors.components.Panels.Visualization.TableNG.RowExpander}
      aria-expanded={isExpanded}
      aria-controls={rowId}
    >
      <Icon name={isExpanded ? 'angle-down' : 'angle-right'} size="lg" aria-hidden="true" />
    </div>
  );
}

const getStyles = (_theme: GrafanaTheme2) => ({
  expanderCell: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    cursor: 'pointer',
  }),
});
