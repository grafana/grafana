import { css } from '@emotion/css';
import React, { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';

import { isValidGoDuration } from '@grafana/data';
import { Modal, Button, Form, Field, Input, useStyles2 } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateLotexNamespaceAndGroupAction } from '../../state/actions';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { getRulesSourceName } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { durationValidationPattern } from '../../utils/time';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';

interface ModalProps {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  onClose: () => void;
}

interface FormValues {
  namespaceName: string;
  groupName: string;
  groupInterval: string;
}

export function EditCloudGroupModal(props: ModalProps): React.ReactElement {
  const { namespace, group, onClose } = props;
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { loading, error, dispatched } =
    useUnifiedAlertingSelector((state) => state.updateLotexNamespaceAndGroup) ?? initialAsyncRequestState;

  const defaultValues = useMemo(
    (): FormValues => ({
      namespaceName: namespace.name,
      groupName: group.name,
      groupInterval: group.interval ?? '',
    }),
    [namespace, group]
  );

  // close modal if successfully saved
  useEffect(() => {
    if (dispatched && !loading && !error) {
      onClose();
    }
  }, [dispatched, loading, onClose, error]);

  useCleanup((state) => (state.unifiedAlerting.updateLotexNamespaceAndGroup = initialAsyncRequestState));

  const onSubmit = (values: FormValues) => {
    dispatch(
      updateLotexNamespaceAndGroupAction({
        rulesSourceName: getRulesSourceName(namespace.rulesSource),
        groupName: group.name,
        newGroupName: values.groupName,
        namespaceName: namespace.name,
        newNamespaceName: values.namespaceName,
        groupInterval: values.groupInterval || undefined,
      })
    );
  };

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title="Edit namespace or rule group"
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
      <Form defaultValues={defaultValues} onSubmit={onSubmit} key={JSON.stringify(defaultValues)}>
        {({ register, errors, formState: { isDirty }, watch }) => (
          <>
            <Field label="Namespace" invalid={!!errors.namespaceName} error={errors.namespaceName?.message}>
              <Input
                id="namespaceName"
                {...register('namespaceName', {
                  required: 'Namespace name is required.',
                })}
              />
            </Field>
            <Field label="Rule group" invalid={!!errors.groupName} error={errors.groupName?.message}>
              <Input
                id="groupName"
                {...register('groupName', {
                  required: 'Rule group name is required.',
                })}
              />
            </Field>
            <Field
              label="Rule group evaluation interval"
              invalid={!!errors.groupInterval}
              error={errors.groupInterval?.message}
            >
              <Input
                id="groupInterval"
                placeholder="1m"
                {...register('groupInterval', {
                  pattern: durationValidationPattern,
                  validate: (input) => {
                    const validDuration = isValidGoDuration(input);
                    if (!validDuration) {
                      return 'Invalid duration. Valid example: 1m (Available units: h, m, s)';
                    }

                    const limitExceeded = !checkEvaluationIntervalGlobalLimit(input).exceedsLimit;
                    if (limitExceeded) {
                      return true;
                    }

                    return false;
                  },
                })}
              />
            </Field>
            {checkEvaluationIntervalGlobalLimit(watch('groupInterval')).exceedsLimit && (
              <EvaluationIntervalLimitExceeded />
            )}

            <Modal.ButtonRow>
              <Button variant="secondary" type="button" disabled={loading} onClick={onClose} fill="outline">
                Close
              </Button>
              <Button type="submit" disabled={!isDirty || loading}>
                {loading ? 'Saving...' : 'Save changes'}
              </Button>
            </Modal.ButtonRow>
          </>
        )}
      </Form>
    </Modal>
  );
}

const getStyles = () => ({
  modal: css`
    max-width: 560px;
  `,
});
