import { css } from '@emotion/css';
import { produce } from 'immer';
import { useCallback, useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Alert,
  Button,
  ConfirmModal,
  Field,
  Input,
  LinkButton,
  Stack,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types/store';
import { GrafanaRulesSourceSymbol, RuleGroupIdentifierV2, RulerDataSourceConfig } from 'app/types/unified-alerting';
import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { logError } from '../Analytics';
import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { EvaluationGroupQuickPick } from '../components/rule-editor/EvaluationGroupQuickPick';
import { useDeleteRuleGroup } from '../hooks/ruleGroup/useDeleteRuleGroup';
import { UpdateGroupDelta, useUpdateRuleGroup } from '../hooks/ruleGroup/useUpdateRuleGroup';
import { isLoading, useAsync } from '../hooks/useAsync';
import { useFolder } from '../hooks/useFolder';
import { useRuleGroupConsistencyCheck } from '../hooks/usePrometheusConsistencyCheck';
import { useReturnTo } from '../hooks/useReturnTo';
import { SwapOperation } from '../reducers/ruler/ruleGroups';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../rule-editor/formDefaults';
import { ruleGroupIdentifierV2toV1 } from '../utils/groupIdentifier';
import { stringifyErrorLike } from '../utils/misc';
import { alertListPageLink, createListFilterLink, groups } from '../utils/navigation';

import { DraggableRulesTable } from './components/DraggableRulesTable';
import { evaluateEveryValidationOptions } from './validation';

type GroupEditPageRouteParams = {
  dataSourceUid?: string;
  namespaceId?: string;
  groupName?: string;
};

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

function GroupEditPage() {
  const dispatch = useDispatch();
  const { dataSourceUid = '', namespaceId = '', groupName = '' } = useParams<GroupEditPageRouteParams>();

  const { folder, loading: isFolderLoading } = useFolder(dataSourceUid === 'grafana' ? namespaceId : '');

  const ruleSourceUid = dataSourceUid === 'grafana' ? GrafanaRulesSourceSymbol : dataSourceUid;
  const {
    data: dsFeatures,
    isLoading: isDsFeaturesLoading,
    error: dsFeaturesError,
  } = useDiscoverDsFeaturesQuery({ uid: ruleSourceUid });

  // We use useAsync instead of RTKQ query to avoid cache invalidation issues when the group is being deleted
  // RTKQ query would refetch the group after it's deleted and we'd end up with a blinking group not found error
  const [getGroupAction, groupRequestState] = useAsync(async (rulerConfig: RulerDataSourceConfig) => {
    return dispatch(
      alertRuleApi.endpoints.getRuleGroupForNamespace.initiate({
        rulerConfig: rulerConfig,
        namespace: namespaceId,
        group: groupName,
      })
    ).unwrap();
  });

  useEffect(() => {
    if (namespaceId && groupName && dsFeatures?.rulerConfig) {
      getGroupAction.execute(dsFeatures.rulerConfig);
    }
  }, [namespaceId, groupName, dsFeatures?.rulerConfig, getGroupAction]);

  const isLoadingGroup = isFolderLoading || isDsFeaturesLoading || isLoading(groupRequestState);
  const { result: rulerGroup, error: ruleGroupError } = groupRequestState;

  const pageNav: NavModelItem = {
    text: t('alerting.group-edit.page-title', 'Edit rule group'),
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
      <AlertingPageWrapper pageNav={pageNav} navId="alert-list" isLoading={isLoadingGroup}>
        <Alert title={t('alerting.group-edit.group-not-editable', 'Selected group cannot be edited')}>
          <Trans i18nKey="alerting.group-edit.group-not-editable-description">
            This group belongs to a data source that does not support editing.
          </Trans>
        </Alert>
      </AlertingPageWrapper>
    );
  }

  const groupIdentifier: RuleGroupIdentifierV2 =
    dataSourceUid === 'grafana'
      ? {
          namespace: { uid: namespaceId },
          groupName: groupName,
          groupOrigin: 'grafana',
        }
      : {
          rulesSource: { uid: dataSourceUid, name: dsFeatures?.name ?? '', ruleSourceType: 'datasource' },
          namespace: { name: namespaceId },
          groupName: groupName,
          groupOrigin: 'datasource',
        };

  return (
    <AlertingPageWrapper pageNav={pageNav} navId="alert-list" isLoading={isLoadingGroup}>
      <>
        {Boolean(dsFeaturesError) && (
          <Alert
            title={t('alerting.group-edit.ds-error', 'Error loading data source details')}
            bottomSpacing={0}
            topSpacing={2}
          >
            <div>{stringifyErrorLike(dsFeaturesError)}</div>
          </Alert>
        )}
        {/* If the rule group is being deleted, RTKQ will try to referch it due to cache invalidation */}
        {/* For a few miliseconds before redirecting, the rule group will be missing and 404 error would blink */}
        {Boolean(ruleGroupError) && (
          <Alert
            title={t('alerting.group-edit.rule-group-error', 'Error loading rule group')}
            bottomSpacing={0}
            topSpacing={2}
          >
            {stringifyErrorLike(ruleGroupError)}
          </Alert>
        )}
      </>
      {rulerGroup && <GroupEditForm rulerGroup={rulerGroup} groupIdentifier={groupIdentifier} />}
      {!rulerGroup && <EntityNotFound entity={`${namespaceId}/${groupName}`} />}
    </AlertingPageWrapper>
  );
}

export default withErrorBoundary(GroupEditPage, { style: 'page' });

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
  const { returnTo } = useReturnTo(groups.detailsPageLinkFromGroupIdentifier(groupIdentifier));
  const { folder } = useFolder(groupIdentifier.groupOrigin === 'grafana' ? groupIdentifier.namespace.uid : '');

  const { waitForGroupConsistency } = useRuleGroupConsistencyCheck();
  const [updateRuleGroup] = useUpdateRuleGroup();
  const [deleteRuleGroup] = useDeleteRuleGroup();
  const [operations, setOperations] = useState<SwapOperation[]>([]);
  const [confirmDeleteOpened, setConfirmDeleteOpened] = useState(false);

  const groupIntervalOrDefault = rulerGroup?.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL;

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
    try {
      const changeDelta: UpdateGroupDelta = {
        namespaceName: dirtyFields.namespace ? data.namespace : undefined,
        groupName: dirtyFields.name ? data.name : undefined,
        interval: dirtyFields.interval ? data.interval : undefined,
        ruleSwaps: operations.length ? operations : undefined,
      };

      const updatedGroupIdentifier = await updateRuleGroup.execute(
        ruleGroupIdentifierV2toV1(groupIdentifier),
        changeDelta
      );

      const shouldWaitForPromConsistency = !!changeDelta.namespaceName || !!changeDelta.groupName;
      if (shouldWaitForPromConsistency) {
        await waitForGroupConsistency(updatedGroupIdentifier);
      }

      const successMessage = t('alerting.group-edit.form.update-success', 'Successfully updated the rule group');
      appInfo.success(successMessage);

      setMatchingGroupPageUrl(updatedGroupIdentifier);
    } catch (error) {
      logError(error instanceof Error ? error : new Error('Failed to update rule group'));
      appInfo.error(
        t('alerting.group-edit.form.update-error', 'Failed to update rule group'),
        stringifyErrorLike(error)
      );
    }
  };

  const onDelete = async () => {
    await deleteRuleGroup.execute(ruleGroupIdentifierV2toV1(groupIdentifier));
    await waitForGroupConsistency(groupIdentifier);
    redirectToListPage();
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        {groupIdentifier.groupOrigin === 'datasource' && (
          <Field
            label={t('alerting.group-edit.form.namespace-label', 'Namespace')}
            required
            invalid={!!errors.namespace}
            error={errors.namespace?.message}
            className={styles.input}
          >
            <Input
              id="namespace"
              {...register('namespace', {
                required: t('alerting.group-edit.form.namespace-required', 'Namespace is required'),
              })}
            />
          </Field>
        )}
        {groupIdentifier.groupOrigin === 'grafana' && (
          <Field label={t('alerting.group-edit.form.folder-label', 'Folder')} required>
            <Input id="folder" value={folder?.title ?? ''} readOnly />
          </Field>
        )}
        <Field
          label={t('alerting.group-edit.form.group-name-label', 'Evaluation group name')}
          required
          invalid={!!errors.name}
          error={errors.name?.message}
          className={styles.input}
        >
          <Input
            id="group-name"
            {...register('name', {
              required: t('alerting.group-edit.form.group-name-required', 'Group name is required'),
            })}
          />
        </Field>
        <Field
          label={t('alerting.group-edit.form.interval-label', 'Evaluation interval')}
          description={t('alerting.group-edit.form.interval-description', 'How often is the group evaluated')}
          invalid={!!errors.interval}
          error={errors.interval?.message}
          className={styles.input}
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
        <Field
          label={t('alerting.group-edit.form.rules-label', 'Alerting and recording rules')}
          description={t('alerting.group-edit.form.rules-description', 'Drag rules to reorder')}
        >
          <DraggableRulesTable rules={rulerGroup.rules} groupInterval={groupIntervalOrDefault} onSwap={onSwap} />
        </Field>

        <Stack>
          <Button type="submit" disabled={isSubmitting} icon={isSubmitting ? 'spinner' : undefined}>
            <Trans i18nKey="alerting.group-edit.form.save">Save</Trans>
          </Button>
          <LinkButton variant="secondary" disabled={isSubmitting} href={returnTo}>
            <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
          </LinkButton>
        </Stack>
      </form>
      {groupIdentifier.groupOrigin === 'datasource' && (
        <Stack direction="row" justifyContent="flex-end">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmDeleteOpened(true)}
            disabled={isSubmitting}
          >
            <Trans i18nKey="alerting.group-edit.form.delete">Delete</Trans>
          </Button>
          <ConfirmModal
            isOpen={confirmDeleteOpened}
            title={t('alerting.group-edit.form.delete-title', 'Delete rule group')}
            body={t('alerting.group-edit.form.delete-body', 'Are you sure you want to delete this rule group?')}
            confirmText={t('alerting.group-edit.form.delete-confirm', 'Delete')}
            onConfirm={onDelete}
            onDismiss={() => setConfirmDeleteOpened(false)}
          />
        </Stack>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  intervalInput: css({
    marginBottom: theme.spacing(0.5),
  }),
  input: css({
    maxWidth: '600px',
  }),
});

function setMatchingGroupPageUrl(groupIdentifier: RuleGroupIdentifierV2) {
  if (groupIdentifier.groupOrigin === 'datasource') {
    const { rulesSource, namespace, groupName } = groupIdentifier;
    locationService.replace(groups.editPageLink(rulesSource.uid, namespace.name, groupName, { skipSubPath: true }));
  } else {
    const { namespace, groupName } = groupIdentifier;
    locationService.replace(groups.editPageLink('grafana', namespace.uid, groupName, { skipSubPath: true }));
  }
}

function redirectToListPage() {
  locationService.replace(alertListPageLink(undefined, { skipSubPath: true }));
}
