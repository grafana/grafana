import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { Rule } from 'app/types/unified-alerting';

import { isErrorHealth } from '../rule-viewer/RuleViewer';

interface Prom {
  rule: Rule;
}

export const RuleHealth = ({ rule }: Prom) => {
  const style = useStyles2(getStyle);

  if (isErrorHealth(rule.health)) {
    return (
      <Tooltip theme="error" content={rule.lastError || 'No error message provided.'}>
        <div className={style.warn}>
          <Icon name="exclamation-triangle" />
          <span>
            <Trans i18nKey="alerting.rule-health.error">error</Trans>
          </span>
        </div>
      </Tooltip>
    );
  }

  return <>{rule.health}</>;
};

const getStyle = (theme: GrafanaTheme2) => ({
  warn: css({
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),

    color: theme.colors.warning.text,
  }),
});
