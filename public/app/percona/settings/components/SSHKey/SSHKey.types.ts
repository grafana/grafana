import { LoadingCallback } from 'app/percona/settings/Settings.service';
import { SSHPayload } from '../../Settings.types';

export interface SSHKeyProps {
  sshKey: string;
  updateSettings: (body: SSHPayload, callback: LoadingCallback) => void;
}
