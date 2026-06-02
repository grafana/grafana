import { cx } from '@emotion/css';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Dropdown, Icon, LinkButton, Menu, useStyles2 } from '@grafana/ui';

import { getDataSourceByUid } from '../../utils/datasource';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { createRelativeUrl } from '../../utils/url';

import { getRuleDesignStyles } from './styles';

export type RuleKind = 'alerting' | 'recording';

interface CommonRowProps {
  showDesc?: boolean;
  density?: 'compact' | 'comfy';
  dim?: boolean;
}

// Discriminated on `kind` so `rule` narrows without type assertions.
type K8sRuleRowProps = CommonRowProps &
  ({ kind: 'alerting'; rule: AlertRule } | { kind: 'recording'; rule: RecordingRule });

// Pull the queried datasource UIDs off a rule. Alerting rules carry them on each
// expression; recording rules expose a single target datasource.
function getDatasources(props: K8sRuleRowProps): DataSourceInstanceSettings[] {
  const uids = new Set<string>();
  if (props.kind === 'recording') {
    const target = props.rule.spec.targetDatasourceUID;
    if (target) {
      uids.add(target);
    }
  } else {
    Object.values(props.rule.spec.expressions ?? {}).forEach((expr) => {
      const uid = expr.datasourceUID;
      // Skip the server-side expression datasource — it isn't a real source.
      if (uid && uid !== '__expr__' && uid !== '-100') {
        uids.add(uid);
      }
    });
  }

  return Array.from(uids)
    .map(getDataSourceByUid)
    .filter((ds): ds is DataSourceInstanceSettings => ds !== undefined);
}

export function K8sRuleRow(props: K8sRuleRowProps) {
  const { rule, kind, showDesc = true, density = 'comfy', dim = false } = props;
  const styles = useStyles2(getRuleDesignStyles);
  const isRecording = kind === 'recording';

  const uid = rule.metadata.name ?? '';
  const title = rule.spec.title || uid;
  const interval = rule.spec.trigger?.interval;
  const provisioned = isK8sEntityProvisioned({ metadata: rule.metadata });
  const labelCount = Object.keys(rule.spec.labels ?? {}).length;
  const description = props.kind === 'alerting' ? props.rule.spec.annotations?.description : undefined;
  const dataSources = getDatasources(props);

  const viewUrl = createRelativeUrl(`/alerting/grafana/${uid}/view`);
  const editUrl = createRelativeUrl(`/alerting/grafana/${uid}/edit`);

  return (
    <div className={cx(styles.rule, density === 'compact' && styles.ruleCompact, dim && styles.ruleDim)}>
      {isRecording ? (
        <span className={styles.recGlyph} title={t('alerting.k8s-rule-row.recording-glyph', 'Recording rule')}>
          ƒ
        </span>
      ) : (
        <span className={styles.statePlaceholder} />
      )}

      <div className={cx(styles.body, density === 'compact' && styles.bodyCompact)}>
        <div className={styles.nameRow}>
          <a className={cx(styles.name, dim && styles.nameDim)} href={viewUrl}>
            {title}
          </a>
          {provisioned && (
            <span className={styles.badgeProvisioned}>
              <Trans i18nKey="alerting.k8s-rule-row.provisioned">Provisioned</Trans>
            </span>
          )}
          {isRecording && (
            <span className={styles.badgeRecording}>
              <Trans i18nKey="alerting.k8s-rule-row.recording">recording</Trans>
            </span>
          )}
        </div>

        {showDesc && description && density !== 'compact' && <div className={styles.desc}>{description}</div>}

        <div className={styles.meta}>
          {dataSources.length > 0
            ? dataSources.map((ds) => (
                <span key={ds.uid} className={styles.ds}>
                  <img className={styles.dsLogo} src={ds.meta.info.logos.small} alt="" />
                  {ds.name}
                </span>
              ))
            : null}
          {labelCount > 0 && (
            <span>
              <Icon name="tag-alt" size="sm" />{' '}
              <Trans i18nKey="alerting.k8s-rule-row.labels" count={labelCount}>
                {'{{count}}'} labels
              </Trans>
            </span>
          )}
        </div>
      </div>

      <div className={styles.actionsRight}>
        {interval && (
          <span className={styles.evalAlways}>
            <Icon name="clock-nine" size="sm" /> {interval}
          </span>
        )}
        <LinkButton variant="secondary" fill="text" size="sm" href={editUrl}>
          <Trans i18nKey="alerting.k8s-rule-row.edit">Edit</Trans>
        </LinkButton>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item label={t('alerting.k8s-rule-row.silence', 'Silence notifications')} icon="bell-slash" />
              <Menu.Item label={t('alerting.k8s-rule-row.duplicate', 'Duplicate')} icon="copy" />
              <Menu.Divider />
              <Menu.Item label={t('alerting.k8s-rule-row.delete', 'Delete')} icon="trash-alt" destructive />
            </Menu>
          }
        >
          <Button variant="secondary" fill="text" size="sm">
            <Trans i18nKey="alerting.k8s-rule-row.more">More</Trans> <Icon name="angle-down" />
          </Button>
        </Dropdown>
      </div>
    </div>
  );
}
