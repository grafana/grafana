import React, { useEffect } from 'react';
import { SilenceFormFields } from '../../types/silence-form';
import { useFormContext } from 'react-hook-form';

export const MatchedSilencedRules = () => {
  const formApi = useFormContext<SilenceFormFields>();
  const { watch } = formApi;
  const matchers = watch('matchers');

  useEffect(() => {
    // lookup matched rules
  }, [matchers]);

  return <div>Matched rules</div>;
};
