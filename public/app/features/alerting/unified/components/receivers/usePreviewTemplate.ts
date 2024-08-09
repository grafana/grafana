import { useCallback, useEffect } from 'react';

import { AlertField, usePreviewTemplateMutation } from '../../api/templateApi';

export function usePreviewTemplate(
  templateContent: string,
  templateName: string,
  payload: string,
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void,
  type?: 'json'
) {
  console.log('usePreviewTemplate called with', type);
  const [trigger, { data, error, isLoading }] = usePreviewTemplateMutation();

  const onPreview = useCallback(() => {
    try {
      const alertList: AlertField[] = JSON.parse(payload);
      JSON.stringify([...alertList]); // check if it's iterable, in order to be able to add more data
      trigger({ template: templateContent, alerts: alertList, name: templateName, type });
      setPayloadFormatError(null);
    } catch (e) {
      setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  }, [payload, trigger, templateContent, templateName, type, setPayloadFormatError]);

  useEffect(() => onPreview(), [onPreview]);

  return { data, error, isLoading, onPreview };
}
