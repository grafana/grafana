import { DataQueryError } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, JSONFormatter } from '@grafana/ui';

interface InspectErrorTabProps {
  errors?: DataQueryError[];
}

const parseErrorMessage = (message: string) => {
  try {
    const [msg, json] = message.split(/(\{.+)/);
    const jsonError = JSON.parse(json);
    return {
      msg,
      json: jsonError,
    };
  } catch {
    return { msg: message };
  }
};

function renderError(error: DataQueryError) {
  if (error.data) {
    return (
      <>
        <h4>{error.data.message}</h4>
        <JSONFormatter json={error} open={2} />
      </>
    );
  }
  if (error.message) {
    const { msg, json } = parseErrorMessage(error.message);
    if (!json) {
      return (
        <>
          {error.status && (
            <Trans i18nKey="inspector.inspect-error-tab.error-status-message" values={{ errorStatus: error.status }}>
              Status: {'{{errorStatus}}'}. Message:
            </Trans>
          )}{' '}
          {msg}
          {error.traceId != null && (
            <>
              <br />
              <Trans i18nKey="inspector.inspect-error-tab.error-trace-message" values={{ errorTrace: error.traceId }}>
                (Trace ID: {'{{errorTrace}}'})
              </Trans>
            </>
          )}
        </>
      );
    } else {
      return (
        <>
          {msg !== '' && <h3>{msg}</h3>}
          {error.status && (
            <Trans i18nKey="inspector.inspect-error-tab.error-status-no-message" values={{ errorStatus: error.status }}>
              Status: {'{{errorStatus}}'}
            </Trans>
          )}
          <JSONFormatter json={json} open={5} />
        </>
      );
    }
  }
  return <JSONFormatter json={error} open={2} />;
}

export const InspectErrorTab = ({ errors }: InspectErrorTabProps) => {
  if (!errors?.length) {
    return null;
  }
  if (errors.length === 1) {
    return renderError(errors[0]);
  }
  return (
    <>
      {errors.map((error, index) => (
        <Alert title={error.refId || `Error ${index + 1}`} severity="error" key={index}>
          {renderError(error)}
        </Alert>
      ))}
    </>
  );
};
