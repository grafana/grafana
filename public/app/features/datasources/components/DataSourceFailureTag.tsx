import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Tag, Tooltip, useStyles2 } from '@grafana/ui';

import { FailureSeverity } from '../../connections/hooks/useDatasourceAdvisorChecks';

interface Props {
  severity: FailureSeverity;
}

const ADVISOR_APP_URL = '/a/grafana-advisor-app';

export function DataSourceFailureTag({ severity }: Props) {
  const styles = useStyles2(getStyles);
  const isHigh = severity === 'high';

  return (
    <Tooltip
      content={
        isHigh
          ? t(
              'datasources.list.failed-high-tooltip',
              'This data source has critical failures reported by Grafana Advisor.'
            )
          : t(
              'datasources.list.failed-low-tooltip',
              'This data source has non-critical issues reported by Grafana Advisor.'
            )
      }
      placement="top"
    >
      <a
        href={`${config.appSubUrl}${ADVISOR_APP_URL}?summaryOpen${isHigh ? 'high' : 'low'}=true`}
        className={styles.link}
      >
        <Tag
          name={isHigh ? t('datasources.list.failed-high', 'failed') : t('datasources.list.failed-low', 'warn')}
          colorIndex={isHigh ? 25 : 7}
        />
      </a>
    </Tooltip>
  );
}

const getStyles = () => ({
  link: css({
    position: 'relative',
    zIndex: 1,
    textDecoration: 'none',
  }),
});
