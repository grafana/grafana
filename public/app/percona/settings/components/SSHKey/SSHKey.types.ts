import { LoadingCallback } from 'app/percona/settings/Settings.service';

export interface SSHKeyProps {
  sshKey: string;
  updateSettings: (body: any, callback: LoadingCallback) => void;
}
