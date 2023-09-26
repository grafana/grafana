import React, { useState, useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';

import { ExploreCorrelationHelperData } from '@grafana/data';
import { Collapse, Alert, Field, Input } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types';

import { changeCorrelationEditorDetails } from './state/main';
import { selectCorrelationDetails } from './state/selectors';

interface Props {
  correlations: ExploreCorrelationHelperData;
}

interface FormValues {
  label: string;
  description: string;
}

export const CorrelationHelper = ({ correlations }: Props) => {
  const dispatch = useDispatch();
  const { register, watch } = useForm<FormValues>();
  const [isOpen, setIsOpen] = useState(false);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const id = useId();

  useEffect(() => {
    const subscription = watch((value) => {
      let dirty = false;

      if (!correlationDetails?.dirty && (value.label !== '' || value.description !== '')) {
        dirty = true;
      } else if (correlationDetails?.dirty && value.label.trim() === '' && value.description.trim() === '') {
        dirty = false;
      }
      dispatch(changeCorrelationEditorDetails({ label: value.label, description: value.description, dirty: dirty }));
    });
    return () => subscription.unsubscribe();
  }, [correlationDetails?.dirty, dispatch, watch]);

  // only fire once on mount to allow save button to enable / disable when unmounted
  useEffect(() => {
    dispatch(changeCorrelationEditorDetails({ canSave: true }));

    return () => {
      dispatch(changeCorrelationEditorDetails({ canSave: false }));
    };
  }, [dispatch]);

  return (
    <Alert title="Correlation details" severity="info">
      The correlation link will appear by the <code>{correlations.resultField}</code> field. You can use the following
      variables to set up your correlations:
      <pre>
        {Object.entries(correlations.vars).map((entry) => {
          return `\$\{${entry[0]}\} = ${entry[1]}\n`;
        })}
      </pre>
      <Collapse
        collapsible
        isOpen={isOpen}
        onToggle={() => {
          setIsOpen(!isOpen);
        }}
        label="Label/Description"
      >
        <Field label="Label" htmlFor={`${id}-label`}>
          <Input {...register('label')} id={`${id}-label`} />
        </Field>
        <Field label="Description" htmlFor={`${id}-description`}>
          <Input {...register('description')} id={`${id}-description`} />
        </Field>
      </Collapse>
    </Alert>
  );
};
