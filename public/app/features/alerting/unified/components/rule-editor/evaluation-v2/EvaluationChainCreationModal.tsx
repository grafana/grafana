import { FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, Label, Modal, Stack } from '@grafana/ui';

import { evaluateEveryValidationOptions } from '../../../group-details/validation';
import { useCreateEvaluationChain } from '../../../hooks/useEvaluationChains';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../../types/rule-form';
import { EvaluationGroupQuickPick } from '../EvaluationGroupQuickPick';

interface EvaluationChainCreationModalProps {
  recordingRuleRefs: string[];
  onClose: () => void;
  onCreated?: () => void;
}

export function EvaluationChainCreationModal({
  recordingRuleRefs,
  onClose,
  onCreated,
}: EvaluationChainCreationModalProps) {
  const parentForm = useFormContext<RuleFormValues>();
  const { createChain, isLoading } = useCreateEvaluationChain();

  const formAPI = useForm({
    defaultValues: { name: '', interval: DEFAULT_GROUP_EVALUATION_INTERVAL },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState, setValue, watch } = formAPI;
  const currentInterval = watch('interval');

  const onSubmit = handleSubmit(async (values) => {
    const result = await createChain({
      name: values.name,
      interval: values.interval,
      recordingRuleRefs,
    });
    parentForm.setValue('evaluationChainUid', result.uid);
    parentForm.setValue('evaluationChainName', values.name);
    parentForm.setValue('evaluateEvery', values.interval);
    onClose();
    onCreated?.();
  });

  return (
    <Modal
      isOpen
      title={t('alerting.evaluation-v2.create-chain-modal.title', 'New evaluation chain')}
      onDismiss={onClose}
    >
      <FormProvider {...formAPI}>
        <form onSubmit={onSubmit}>
          <Stack direction="column" gap={2}>
            <Field
              noMargin
              label={
                <Label htmlFor="chain-name">
                  <Trans i18nKey="alerting.evaluation-v2.create-chain-modal.name-label">Evaluation chain name</Trans>
                </Label>
              }
              error={formState.errors.name?.message}
              invalid={Boolean(formState.errors.name)}
            >
              <Input
                id="chain-name"
                autoFocus
                {...register('name', {
                  required: {
                    value: true,
                    message: t('alerting.evaluation-v2.create-chain-modal.name-required', 'Required.'),
                  },
                })}
              />
            </Field>

            <Field
              noMargin
              label={
                <Label htmlFor="chain-interval">
                  <Trans i18nKey="alerting.evaluation-v2.create-chain-modal.interval-label">Evaluation interval</Trans>
                </Label>
              }
              error={formState.errors.interval?.message}
              invalid={Boolean(formState.errors.interval)}
            >
              <Input
                id="chain-interval"
                placeholder={DEFAULT_GROUP_EVALUATION_INTERVAL}
                {...register('interval', evaluateEveryValidationOptions([]))}
              />
            </Field>

            <EvaluationGroupQuickPick
              currentInterval={currentInterval}
              onSelect={(interval) => setValue('interval', interval, { shouldValidate: true })}
            />
          </Stack>

          <Modal.ButtonRow>
            <Button variant="secondary" type="button" onClick={onClose}>
              <Trans i18nKey="alerting.evaluation-v2.create-chain-modal.cancel">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={!formState.isValid || isLoading}>
              <Trans i18nKey="alerting.evaluation-v2.create-chain-modal.create">Create</Trans>
            </Button>
          </Modal.ButtonRow>
        </form>
      </FormProvider>
    </Modal>
  );
}
