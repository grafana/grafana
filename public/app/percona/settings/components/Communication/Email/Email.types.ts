import { LoadingCallback } from '../../../Settings.service';
import { EmailAuthType, EmailPayload, EmailSettings } from '../../../Settings.types';

export interface EmailProps {
  settings: EmailSettings;
  updateSettings: (body: EmailPayload, callback: LoadingCallback) => void;
}

export interface FormEmailSettings extends Omit<EmailSettings, 'identity' | 'secret' | 'require_tls'> {
  authType: EmailAuthType;
  requireTls: boolean;
}
