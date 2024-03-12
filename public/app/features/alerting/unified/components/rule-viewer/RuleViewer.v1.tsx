import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import {
  Alert,
  Button,
  Collapse,
  Icon,
  IconButton,
  LoadingPlaceholder,
  useStyles2,
  VerticalGroup,
  Stack,
  Text,
} from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { GrafanaRuleDefinition } from '../../../../../types/unified-alerting-dto';
import { useCombinedRule } from '../../hooks/useCombinedRule';
import { useCleanAnnotations } from '../../utils/annotations';
import { getRulesSourceByName } from '../../utils/datasource';
import * as ruleId from '../../utils/rule-id';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { decodeGrafanaNamespace } from '../expressions/util';
import { RuleViewerLayout } from '../rule-viewer/RuleViewerLayout';
import { RuleDetailsActionButtons } from '../rules/RuleDetailsActionButtons';
import { RuleDetailsAnnotations } from '../rules/RuleDetailsAnnotations';
import { RuleDetailsDataSources } from '../rules/RuleDetailsDataSources';
import { RuleDetailsExpression } from '../rules/RuleDetailsExpression';
import { RuleDetailsFederatedSources } from '../rules/RuleDetailsFederatedSources';
import { RuleDetailsMatchingInstances } from '../rules/RuleDetailsMatchingInstances';
import { RuleHealth } from '../rules/RuleHealth';
import { RuleState } from '../rules/RuleState';

import { QueryResults } from './tabs/Query';

type RuleViewerProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;

const errorMessage = 'Could not find data source for rule';
const errorTitle = 'Could not view rule';
const pageTitle = 'View rule';

export function RuleViewer({ match }: RuleViewerProps) {
  const styles = useStyles2(getStyles);
  const [expandQuery, setExpandQuery] = useToggle(false);

  const identifier = useMemo(() => {
    const id = ruleId.getRuleIdFromPathname(match.params);
    if (!id) {
      throw new Error('Rule ID is required');
    }

    return ruleId.parse(id, true);
  }, [match.params]);

  const { loading, error, result: rule } = useCombinedRule({ ruleIdentifier: identifier });

  const annotations = useCleanAnnotations(rule?.annotations || {});

  if (!identifier?.ruleSourceName) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <Alert title={errorTitle}>
          <details className={styles.errorMessage}>{errorMessage}</details>
        </Alert>
      </RuleViewerLayout>
    );
  }

  const rulesSource = getRulesSourceByName(identifier.ruleSourceName);

  if (loading) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <LoadingPlaceholder text="Loading rule..." />
      </RuleViewerLayout>
    );
  }

  if (error || !rulesSource) {
    return (
      <Alert title={errorTitle}>
        <details className={styles.errorMessage}>
          {isFetchError(error) ? error.message : errorMessage}
          <br />
          {/* TODO  Fix typescript */}
          {/* {error && error?.stack} */}
        </details>
      </Alert>
    );
  }

  if (!rule) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <span>Rule could not be found.</span>
      </RuleViewerLayout>
    );
  }

  const isFederatedRule = isFederatedRuleGroup(rule.group);
  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  return (
    <RuleViewerLayout
      wrapInContent={false}
      title={pageTitle}
      renderTitle={() => (
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <Icon name="bell" size="xl" />
          <Text variant="h3">{rule.name}</Text>
          <RuleState rule={rule} isCreating={false} isDeleting={false} />
        </Stack>
      )}
    >
      {isFederatedRule && (
        <Alert severity="info" title="This rule is part of a federated rule group.">
          <VerticalGroup>
            Federated rule groups are currently an experimental feature.
            <Button fill="text" icon="book">
              <a href="https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation">
                Read documentation
              </a>
            </Button>
          </VerticalGroup>
        </Alert>
      )}
      {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.AlertRule} />}
      <>
        <RuleDetailsActionButtons rule={rule} rulesSource={rulesSource} isViewMode={true} />
        <div className={styles.details}>
          <div className={styles.leftSide}>
            {rule.promRule && (
              <DetailsField label="Health" horizontal={true}>
                <RuleHealth rule={rule.promRule} />
              </DetailsField>
            )}
            {!!rule.labels && !!Object.keys(rule.labels).length && (
              <DetailsField label="Labels" horizontal={true}>
                <AlertLabels labels={rule.labels} />
              </DetailsField>
            )}
            <RuleDetailsExpression rulesSource={rulesSource} rule={rule} annotations={annotations} />
            <RuleDetailsAnnotations annotations={annotations} />
          </div>
          <div className={styles.rightSide}>
            <RuleDetailsDataSources rule={rule} rulesSource={rulesSource} />
            {isFederatedRule && <RuleDetailsFederatedSources group={rule.group} />}
            <DetailsField label="Namespace / Group" className={styles.rightSideDetails}>
              {decodeGrafanaNamespace(rule.namespace).name} / {rule.group.name}
            </DetailsField>
            {isGrafanaRulerRule(rule.rulerRule) && <GrafanaRuleUID rule={rule.rulerRule.grafana_alert} />}
          </div>
        </div>
        <div>
          <DetailsField label="Matching instances" horizontal={true}>
            <RuleDetailsMatchingInstances
              rule={rule}
              pagination={{ itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }}
              enableFiltering
            />
          </DetailsField>
        </div>
      </>
      <Collapse
        label="Query & Results"
        isOpen={expandQuery}
        onToggle={setExpandQuery}
        collapsible={true}
        className={styles.collapse}
      >
        {expandQuery && <QueryResults rule={rule} />}
      </Collapse>
    </RuleViewerLayout>
  );
}

function GrafanaRuleUID({ rule }: { rule: GrafanaRuleDefinition }) {
  const styles = useStyles2(getStyles);
  const copyUID = () => navigator.clipboard && navigator.clipboard.writeText(rule.uid);

  return (
    <DetailsField label="Rule UID" childrenWrapperClassName={styles.ruleUid}>
      {rule.uid} <IconButton name="copy" onClick={copyUID} tooltip="Copy rule UID" />
    </DetailsField>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    errorMessage: css`
      white-space: pre-wrap;
    `,
    queries: css`
      height: 100%;
      width: 100%;
    `,
    collapse: css`
      margin-top: ${theme.spacing(2)};
      border-color: ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
    `,
    queriesTitle: css`
      padding: ${theme.spacing(2, 0.5)};
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      font-family: ${theme.typography.h5.fontFamily};
    `,
    query: css`
      border-bottom: 1px solid ${theme.colors.border.medium};
      padding: ${theme.spacing(2)};
    `,
    queryWarning: css`
      margin: ${theme.spacing(4, 0)};
    `,
    title: css`
      font-size: ${theme.typography.h4.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    `,
    details: css`
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(4)};
    `,
    leftSide: css`
      flex: 1;
      overflow: hidden;
    `,
    rightSide: css`
      padding-right: ${theme.spacing(3)};

      max-width: 360px;
      word-break: break-all;
      overflow: hidden;
    `,
    rightSideDetails: css`
      & > div:first-child {
        width: auto;
      }
    `,
    labels: css`
      justify-content: flex-start;
    `,
    ruleUid: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
  };
};

export default RuleViewer;
