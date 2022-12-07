import { LoaderButtonProps } from '@percona/platform-core';

export interface DBaaSPageButtonsProps {
  pageName: string;
  cancelUrl: string;
  submitBtnProps: LoaderButtonProps & { buttonMessage?: string };
}
