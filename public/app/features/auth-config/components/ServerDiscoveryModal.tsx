import { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { Button, Input, Field, Modal } from '@grafana/ui';

import { Trans } from '../../../core/internationalization';
import { ServerDiscoveryFormData } from '../types';
import { isUrlValid } from '../utils/url';

interface OwnProps {
  isOpen: boolean | undefined;
  onClose: () => void;
  onSuccess: (data: ServerDiscoveryFormData) => void;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

const connector = connect(undefined, {});

export const ServerDiscoveryModalUnconnected = ({ isOpen, onClose, onSuccess }: Props): JSX.Element => {
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

  const onSubmit = (data: ServerDiscoveryFormData) => {
    onSuccess(data);
  };

  return (
    <Modal title="Server discovery URL" onDismiss={onClose} onClickBackdrop={onClose} isOpen={isOpen}>
      <form
        onSubmit={(e) => {
          e.stopPropagation();
          return handleSubmit(onSubmit)(e);
        }}
      >
        <Field
          label="The .well-known/openid-configuration endpoint for your IdP"
          invalid={!!errors.url}
          error={errors.url?.message}
          htmlFor="url"
        >
          <Input {...register('url', { validate: validateUrl })} width={80} id="url" />
        </Field>
        <Modal.ButtonRow>
          <Button type="submit" size="md" variant="primary">
            <Trans i18nKey={'oauth.form.server-discovery-modal-submit'}>Submit</Trans>
          </Button>
          <Button type="button" size="md" variant="secondary" onClick={onClose}>
            <Trans i18nKey={'oauth.form.server-discovery-modal-close'}>Close</Trans>
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};

export default connector(ServerDiscoveryModalUnconnected);
