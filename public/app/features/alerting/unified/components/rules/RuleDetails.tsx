import { Rule, RulesSource } from 'app/types/unified-alerting/internal';
import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { RuleQuery } from '../RuleQuery';
import { isAlertingRule } from '../../utils/rules';
import { isCloudRulesSource } from '../../utils/datasource';
import { Annotation } from '../Annotation';
import { AlertLabels } from '../AlertLabels';
import { AlertInstancesTable } from './AlertInstancesTable';

interface Props {
  rule: Rule;
  rulesSource: RulesSource;
}

export const RuleDetails: FC<Props> = ({ rule, rulesSource }) => {
  const styles = useStyles(getStyles);

  const annotations = Object.entries((isAlertingRule(rule) && rule.annotations) || {});

  return (
    <div className={styles.wrapper}>
      <div className={styles.leftSide}>
        {!!rule.labels && !!Object.keys(rule.labels).length && (
          <div className={cx(styles.field, styles.fieldHorizontal)}>
            <div>Labels</div>
            <div>
              <AlertLabels labels={rule.labels} />
            </div>
          </div>
        )}
        <div className={cx(styles.field, { [styles.exprRow]: !!annotations.length })}>
          <div>Expression</div>
          <div>
            <RuleQuery rule={rule} rulesSource={rulesSource} />
          </div>
        </div>
        {annotations.map(([key, value]) => (
          <div key={key} className={cx(styles.field, styles.fieldHorizontal)}>
            <div>{key}</div>
            <div className={styles.annotationValue}>
              <Annotation annotationKey={key} value={value} />
            </div>
          </div>
        ))}
        {isAlertingRule(rule) && !!rule.alerts?.length && (
          <div className={cx(styles.field, styles.fieldHorizontal)}>
            <div>Matching instances</div>
            <div>
              <AlertInstancesTable instances={rule.alerts} />
            </div>
          </div>
        )}
      </div>
      <div className={styles.rightSide}>
        <div className={cx(styles.field, styles.fieldVertical)}>
          <div>Data source</div>
          <div>
            {isCloudRulesSource(rulesSource) && (
              <>
                <img className={styles.datasourceIcon} src={rulesSource.meta.info.logos.small} /> {rulesSource.name}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    display: flex;
    flex-direction: row;
  `,
  leftSide: css`
    flex: 1;
  `,
  rightSide: css`
    padding-left: 90px;
    width: 300px;
  `,
  exprRow: css`
    margin-bottom: 46px;
  `,
  fieldHorizontal: css`
    flex-direction: row;
  `,
  fieldVertical: css`
    flex-direction: column;
  `,
  field: css`
    display: flex;
    margin: ${theme.spacing.md} 0;

    & > div:first-child {
      width: 110px;
      padding-right: ${theme.spacing.sm};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.bold};
      line-height: ${theme.typography.lineHeight.lg};
    }
    & > div:nth-child(2) {
      flex: 1;
      color: ${theme.colors.textSemiWeak};
    }
  `,
  datasourceIcon: css`
    width: ${theme.spacing.md};
    height: ${theme.spacing.md};
  `,
  annotationValue: css`
    word-break: break-all;
  `,
});
