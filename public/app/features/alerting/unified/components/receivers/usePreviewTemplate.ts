import { useCallback, useEffect } from 'react';

import { type TemplateGroupTemplateKind } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

import { type AlertField, usePreviewTemplateMutation } from '../../api/templateApi';

export function usePreviewTemplate(
  templateContent: string,
  templateName: string,
  payload: string,
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void,
  kind?: TemplateGroupTemplateKind
) {
  const [trigger, { data, error, isLoading }] = usePreviewTemplateMutation();

  const onPreview = useCallback(() => {
    try {
      const alertList: AlertField[] = JSON.parse(payload);
      JSON.stringify([...alertList]); // check if it's iterable, in order to be able to add more data
      trigger({ template: templateContent, alerts: alertList, name: templateName, kind });
      setPayloadFormatError(null);
    } catch (e) {
      setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  }, [templateContent, templateName, payload, setPayloadFormatError, trigger, kind]);

  useEffect(() => onPreview(), [onPreview]);

  return { data, error, isLoading, onPreview };
}
