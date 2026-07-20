import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';

export function EmptyTablePlaceholder({ noValue }: { noValue?: string }) {
  const styles = useStyles2(getStyles);
  return <div className={styles}>{noValue ?? <Trans i18nKey="grafana-ui.table.no-rows">No rows</Trans>}</div>;
}

const getStyles = (theme: GrafanaTheme2) =>
  css({
    gridColumn: '1/-1',
    placeSelf: 'center',
    color: theme.colors.text.secondary,
  });
