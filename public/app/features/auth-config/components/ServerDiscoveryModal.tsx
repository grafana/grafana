import { useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Input, Field, Modal } from '@grafana/ui';

import { ServerDiscoveryFormData } from '../types';
import { isUrlValid } from '../utils/url';

interface Props {
  isOpen: boolean | undefined;
  onClose: () => void;
  onSuccess: (data: ServerDiscoveryFormData) => void;
  isLoading: boolean;
}

export const ServerDiscoveryModal = ({ isOpen, onClose, onSuccess, isLoading }: Props) => {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      url: '',
    },
  });

  const validateUrl = (value?: string) => {
    if (value === '') {
      return 'Please enter the .well-known/openid-configuration endpoint for your IdP';
    }

    if (!isUrlValid(value)) {
      return 'Please enter a valid URL';
    }

    return true;
  };

  return (
    <Modal
      title={t(
        'auth-config.server-discovery-modal.title-open-id-connect-discovery-url',
        'OpenID Connect Discovery URL'
      )}
      onDismiss={onClose}
      onClickBackdrop={onClose}
      isOpen={isOpen}
    >
      <form
        onSubmit={(e) => {
          e.stopPropagation();
          return handleSubmit(onSuccess)(e);
        }}
      >
        <Field
          label={t(
            'auth-config.server-discovery-modal.label-the-wellknownopenidconfiguration-endpoint-for-your-id-p',
            'The .well-known/openid-configuration endpoint for your IdP'
          )}
          invalid={!!errors.url}
          error={errors.url?.message}
          htmlFor="url"
        >
          <Input {...register('url', { validate: validateUrl })} width={80} id="url" />
        </Field>
        <Modal.ButtonRow>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? (
              <Trans i18nKey={'oauth.form.server-discovery-modal-loading'}>Loading...</Trans>
            ) : (
              <Trans i18nKey={'oauth.form.server-discovery-modal-submit'}>Submit</Trans>
            )}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            <Trans i18nKey={'oauth.form.server-discovery-modal-close'}>Close</Trans>
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};
