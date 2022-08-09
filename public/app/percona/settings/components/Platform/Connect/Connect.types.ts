import { ConnectRenderProps } from '../types';

export interface ConnectProps {
  onConnect: (values: ConnectRenderProps, setPMMAddress: boolean) => void;
  connecting: boolean;
  initialValues: ConnectRenderProps;
}
