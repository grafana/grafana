import { LoaderButtonProps } from 'app/percona/shared/components/Elements/LoaderButton';

export interface DBaaSPageButtonsProps {
  pageName: string;
  cancelUrl: string;
  submitBtnProps: LoaderButtonProps & { buttonMessage?: string };
}
