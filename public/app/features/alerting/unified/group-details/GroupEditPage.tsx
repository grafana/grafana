import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { produce } from 'immer';
import { useCallback, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, Button, Field, Input, Stack, useStyles2, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans, t } from 'app/core/internationalization';
import { GrafanaRulesSourceSymbol, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { EvaluationGroupQuickPick } from '../components/rule-editor/EvaluationGroupQuickPick';
import { evaluateEveryValidationOptions } from '../components/rules/EditRuleGroupModal';
import { UpdateGroupDelta, useUpdateRuleGroup } from '../hooks/ruleGroup/useUpdateRuleGroup';
import { useFolder } from '../hooks/useFolder';
import { useRuleGroupConsistencyCheck } from '../hooks/usePrometheusConsistencyCheck';
import { SwapOperation } from '../reducers/ruler/ruleGroups';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../rule-editor/formDefaults';
import { ruleGroupIdentifierV2toV1 } from '../utils/groupIdentifier';
import { stringifyErrorLike } from '../utils/misc';
import { createListFilterLink, groups } from '../utils/navigation';

import { DraggableRulesTable } from './components/DraggableRulesTable';

interface GroupEditFormProps {
  rulerGroup: RulerRuleGroupDTO;
  groupIdentifier: RuleGroupIdentifierV2;
}

interface GroupEditFormData {
  name: string;
  interval: string;
  namespace?: string;
}

function GroupEditForm({ rulerGroup, groupIdentifier }: GroupEditFormProps) {
  const styles = useStyles2(getStyles);
  const appInfo = useAppNotification();
  const { folder } = useFolder(groupIdentifier.groupOrigin === 'grafana' ? groupIdentifier.namespace.uid : '');

  const { waitForGroupConsistency } = useRuleGroupConsistencyCheck();
  const [updateRuleGroup] = useUpdateRuleGroup();
  const groupIntervalOrDefault = rulerGroup?.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL;
  const [operations, setOperations] = useState<SwapOperation[]>([]);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<GroupEditFormData>({
    mode: 'onBlur',
    shouldFocusError: true,
    defaultValues: {
      name: rulerGroup.name,
      interval: rulerGroup.interval,
      namespace: groupIdentifier.groupOrigin === 'datasource' ? groupIdentifier.namespace.name : undefined,
    },
  });

  const onSwap = useCallback((swapOperation: SwapOperation) => {
    setOperations((prevOperations) => {
      return produce(prevOperations, (draft) => {
        draft.push(swapOperation);
      });
    });
  }, []);

  const onSubmit: SubmitHandler<GroupEditFormData> = async (data) => {
    const changeDelta: UpdateGroupDelta = {
      namespaceName: dirtyFields.namespace ? data.namespace : undefined,
      groupName: dirtyFields.name ? data.name : undefined,
      interval: dirtyFields.interval ? data.interval : undefined,
      ruleSwaps: operations.length ? operations : undefined,
    };

    const updatedGroupIdentifier = await updateRuleGroup.execute(
      ruleGroupIdentifierV2toV1(groupIdentifier),
      changeDelta,
      {
        // We need to update the URL before the old group is deleted
        // Otherwise, RTKQ will refetch the old group after it's deleted
        // and we'll end up with a blinking group not found error
        beforeGroupCleanup: (newGroupIdentifier) => setMatchingGroupPageUrl(newGroupIdentifier),
      }
    );

    await waitForGroupConsistency(updatedGroupIdentifier);

    const successMessage = t('alerting.rule-groups.move.success', 'Successfully updated the rule group');
    appInfo.success(successMessage);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {groupIdentifier.groupOrigin === 'datasource' && (
        <Field label="Namespace" required invalid={!!errors.namespace} error={errors.namespace?.message}>
          <Input id="namespace" {...register('namespace', { required: 'Namespace is required' })} />
        </Field>
      )}
      {groupIdentifier.groupOrigin === 'grafana' && (
        <Field label="Folder" required>
          <Input id="folder" value={folder?.title ?? ''} readOnly />
        </Field>
      )}
      <Field label="Evaluation group name" required invalid={!!errors.name} error={errors.name?.message}>
        <Input id="group-name" {...register('name', { required: 'Group name is required' })} />
      </Field>
      <Field
        label="Evaluation interval"
        description="How often is the group evaluated"
        invalid={!!errors.interval}
        error={errors.interval?.message}
        htmlFor="interval"
      >
        <>
          <Input
            id="interval"
            {...register('interval', evaluateEveryValidationOptions(rulerGroup.rules))}
            className={styles.intervalInput}
          />
          <EvaluationGroupQuickPick
            currentInterval={getValues('interval')}
            onSelect={(value) => setValue('interval', value, { shouldValidate: true, shouldDirty: true })}
          />
        </>
      </Field>
      <Field label="Alerting and recording rules" description="Drag rules to reorder">
        <DraggableRulesTable rules={rulerGroup.rules} groupInterval={groupIntervalOrDefault} onSwap={onSwap} />
      </Field>

      <Stack>
        <Button type="submit" disabled={isSubmitting} icon={isSubmitting ? 'spinner' : undefined}>
          Save
        </Button>
      </Stack>
    </form>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  intervalInput: css({
    marginBottom: theme.spacing(0.5),
  }),
});

function setMatchingGroupPageUrl(groupIdentifier: RuleGroupIdentifierV2) {
  if (groupIdentifier.groupOrigin === 'datasource') {
    const { rulesSource, namespace, groupName } = groupIdentifier;
    locationService.replace(groups.editPageLink(rulesSource.uid, namespace.name, groupName));
  } else {
    const { namespace, groupName } = groupIdentifier;
    locationService.replace(groups.editPageLink('grafana', namespace.uid, groupName));
  }
}

type GroupEditPageRouteParams = {
  sourceId?: string;
  namespaceId?: string;
  groupName?: string;
};

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;

function GroupEditPage() {
  const { sourceId = '', namespaceId = '', groupName = '' } = useParams<GroupEditPageRouteParams>();

  const { folder, loading: isFolderLoading } = useFolder(sourceId === 'grafana' ? namespaceId : '');

  const ruleSourceUid = sourceId === 'grafana' ? GrafanaRulesSourceSymbol : sourceId;
  const {
    data: dsFeatures,
    isLoading: isDsFeaturesLoading,
    error: dsFeaturesError,
  } = useDiscoverDsFeaturesQuery({ uid: ruleSourceUid });

  const {
    data: rulerGroup,
    isLoading: isRuleGroupLoading,
    isUninitialized: isRuleGroupUninitialized,
    error: ruleGroupError,
  } = useGetRuleGroupForNamespaceQuery(
    dsFeatures?.rulerConfig
      ? {
          rulerConfig: dsFeatures.rulerConfig,
          namespace: namespaceId,
          group: groupName,
        }
      : skipToken
  );

  const isLoading = isFolderLoading || isDsFeaturesLoading || isRuleGroupLoading || isRuleGroupUninitialized;

  const pageNav: NavModelItem = {
    text: 'Edit rule group',
    parentItem: {
      text: folder?.title ?? namespaceId,
      url: createListFilterLink([
        ['namespace', folder?.title ?? namespaceId],
        ['group', groupName],
      ]),
    },
  };

  if (!!dsFeatures && !dsFeatures.rulerConfig) {
    return (
      <AlertingPageWrapper pageNav={pageNav} title={groupName} isLoading={isLoading}>
        <Alert title={t('alerting.rule-groups.edit.group-not-editable', 'Selected group cannot be edited')}>
          <Trans i18nKey="alerting.rule-groups.edit.group-not-editable-description">
            This group belongs to a data source that does not support editing.
          </Trans>
        </Alert>
      </AlertingPageWrapper>
    );
  }

  const groupIdentifier: RuleGroupIdentifierV2 =
    sourceId === 'grafana'
      ? {
          namespace: { uid: namespaceId },
          groupName: groupName,
          groupOrigin: 'grafana',
        }
      : {
          rulesSource: { uid: sourceId, name: dsFeatures?.name ?? '', ruleSourceType: 'datasource' },
          namespace: { name: namespaceId },
          groupName: groupName,
          groupOrigin: 'datasource',
        };

  return (
    <AlertingPageWrapper
      pageNav={pageNav}
      title={t('alerting.rule-groups.edit.title', 'Edit evaluation group')}
      navId="alert-list"
      isLoading={isLoading}
    >
      <>
        {dsFeaturesError && (
          <Alert
            title={t('alerting.rule-groups.edit.ds-error', 'Error loading data source details')}
            bottomSpacing={0}
            topSpacing={2}
          >
            <div>{stringifyErrorLike(dsFeaturesError)}</div>
          </Alert>
        )}
        {ruleGroupError && (
          <Alert
            title={t('alerting.rule-groups.edit.rule-group-error', 'Error loading rule group')}
            bottomSpacing={0}
            topSpacing={2}
          >
            {stringifyErrorLike(ruleGroupError)}
          </Alert>
        )}
      </>
      {!isLoading && !rulerGroup && <EntityNotFound entity={`${namespaceId}/${groupName}`} />}
      {!isLoading && rulerGroup && <GroupEditForm rulerGroup={rulerGroup} groupIdentifier={groupIdentifier} />}
    </AlertingPageWrapper>
  );
}

export default withErrorBoundary(GroupEditPage, { style: 'page' });
