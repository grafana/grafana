import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { ExploreCorrelationsPanelState } from '@grafana/data';
import { Collapse, Alert, Field, Input } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types';

import { changeCorrelationDetails } from './state/main';
import { selectCorrelationDetails } from './state/selectors';

export const CorrelationHelper = ({ correlations }: { correlations: ExploreCorrelationsPanelState }) => {
  const dispatch = useDispatch();
  const { register, watch } = useForm();
  const [isOpen, setIsOpen] = useState(false);
  const correlationDetails = useSelector(selectCorrelationDetails);

  useEffect(() => {
    const subscription = watch((value, { name, type }) =>
    {
      let dirty = false;

      if (!correlationDetails?.dirty && (value.label !== '' || value.description !== '')) {
        dirty = true;
      } else if (correlationDetails?.dirty && value.label.trim() === '' && value.description.trim() === '' ) {
        dirty = false;
      }
      dispatch(changeCorrelationDetails({label: value.label, description: value.description, dirty: dirty}));
    }
    )
    return () => subscription.unsubscribe()
  }, [correlationDetails?.dirty, dispatch, watch])

  // only fire once on mount to allow save button to enable
  useEffect(() => {
    dispatch(changeCorrelationDetails({canSave: true}));

    return () => {
      dispatch(changeCorrelationDetails({canSave: false}));
    }
  }, [dispatch]);

  return (
    <Alert title="Correlation Details" severity="info">
      The selected field is <code>{correlations.resultField}</code>.
      You can use following variables to set up your correlations:
      <pre>
        {Object.entries(correlations.vars).map((entry, index) => {
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
        <Field label="Label">
          <Input {...register('label')} />
        </Field>
        <Field label="Description">
          <Input {...register('description')} />
        </Field>
      </Collapse>
    </Alert>
  );
};
