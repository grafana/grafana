import React, { type ReactElement, useEffect } from 'react';

import { locationService, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Field, Form, Input, Modal } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreItemSelector } from 'app/features/explore/state/selectors';
import { AccessControlAction, useSelector } from 'app/types';

import { RuleFormValues } from '../../types/rule-form';
import { exploreToRuleFormValues } from '../../utils/rule-form';
import { createUrl } from '../../utils/url';

type FormDTO = {
  name: string;
};

function getNewAlertRuleURL(queryData: Partial<RuleFormValues>) {
  const returnTo = window.location.href;
  const defaults = JSON.stringify(queryData);

  return createUrl('/alerting/new/alerting', {
    returnTo,
    defaults,
  });
}

interface Props {
  exploreId: string;
  onClose: () => void;
}

export function NewAlertRuleFromExploreForm(props: Props): ReactElement {
  const { exploreId, onClose } = props;
  const exploreItem = useSelector(getExploreItemSelector(exploreId))!;

  useEffect(() => {
    reportInteraction('add_to_new_alertrule');
  }, []);

  // TODO better error handling here?
  const canCreateAlertRule =
    contextSrv.hasAccess(AccessControlAction.AlertingRuleCreate, contextSrv.isEditor) ||
    contextSrv.hasAccess(AccessControlAction.AlertingRuleExternalWrite, contextSrv.isEditor);
  if (!canCreateAlertRule) {
    return (
      <Alert title={'Insufficient permissions'} severity="error">
        You have insufficient permissions for this action.
      </Alert>
    );
  }

  const onSubmit = async (data: FormDTO) => {
    reportInteraction('add_to_new_alertrule_submit', {
      queries: exploreItem.queries.length,
    });

    onClose();

    const alertRuleFormData = await exploreToRuleFormValues(exploreItem, data.name);

    const goTo = getNewAlertRuleURL(alertRuleFormData);
    locationService.push(goTo);
  };

  // TODO maybe check if name is already taken? This would only work when we add more input / select elements.
  // Do we want to add more stuff here like namespace / group selection?
  return (
    <Form onSubmit={onSubmit} defaultValues={{ name: '' }}>
      {({ register, errors }) => (
        <>
          <Field label="Name" invalid={Boolean(errors.name)} error={'Name is required'}>
            <Input placeholder="Alert rule name" {...register('name', { required: true })} />
          </Field>
          <Modal.ButtonRow>
            <Button type="reset" onClick={onClose} fill="outline" variant="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon="plus">
              Create new alert rule
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </Form>
  );
}
