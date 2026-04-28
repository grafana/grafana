import { css } from '@emotion/css';
import { type ReactElement } from 'react';

import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { type FailureSeverity } from '../../connections/hooks/useDatasourceAdvisorChecks';

interface Props {
  severity: FailureSeverity;
  message?: string;
}

export function DataSourceFailureBadge({ severity, message }: Props) {
  const styles = useStyles2(getStyles);
  const isHigh = severity === 'high';
  const fallbackTooltip = isHigh
    ? t('datasources.list.failed-high-tooltip', 'This data source has critical failures reported by Grafana Advisor.')
    : t('datasources.list.failed-low-tooltip', 'This data source has non-critical issues reported by Grafana Advisor.');
  const tooltipContent: string | ReactElement = message ? (
    <span className={styles.tooltipContent} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(message) }} />
  ) : (
    fallbackTooltip
  );

  return (
    <Badge
      icon="exclamation-triangle"
      text={isHigh ? t('datasources.list.failed-high', 'failed') : t('datasources.list.failed-low', 'warning')}
      color={isHigh ? 'red' : 'orange'}
      tooltip={tooltipContent}
      className={styles.trigger}
    />
  );
}

const getStyles = () => ({
  trigger: css({
    display: 'inline-flex',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    position: 'relative',
    zIndex: 1,
    cursor: 'help',
  }),
  tooltipContent: css({
    whiteSpace: 'normal',
  }),
});
