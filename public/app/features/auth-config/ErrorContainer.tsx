import { connect, ConnectedProps } from 'react-redux';

import { Alert } from '@grafana/ui';
import { StoreState } from 'app/types/store';

import { resetError, resetWarning } from './state/reducers';

function mapStateToProps(state: StoreState) {
  return {
    error: state.authConfig.updateError,
    warning: state.authConfig.warning,
  };
}

const mapDispatchToProps = {
  resetError,
  resetWarning,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = ConnectedProps<typeof connector>;

export const ErrorContainerUnconnected = ({ error, warning, resetError, resetWarning }: Props): JSX.Element => {
  return (
    <div>
      {error && (
        <Alert title={error.message} onRemove={() => resetError()}>
          {error.errors?.map((e, i) => <div key={i}>{e}</div>)}
        </Alert>
      )}
      {warning && (
        <Alert title={warning.message} onRemove={() => resetWarning()} severity="warning">
          {warning.errors?.map((e, i) => <div key={i}>{e}</div>)}
        </Alert>
      )}
    </div>
  );
};

export default connector(ErrorContainerUnconnected);
