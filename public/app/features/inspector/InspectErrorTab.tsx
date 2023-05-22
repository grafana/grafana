import React from 'react';

import { DataQueryError } from '@grafana/data';
import { Alert, JSONFormatter } from '@grafana/ui';

interface InspectErrorTabProps {
  errors?: DataQueryError[];
}

const parseErrorMessage = (message: string): { msg: string; json?: any } => {
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
          {error.status && <>Status: {error.status}. Message: </>}
          {msg}
        </>
      );
    } else {
      return (
        <>
          {msg !== '' && <h3>{msg}</h3>}
          {error.status && <>Status: {error.status}</>}
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
        <Alert title={error.refId || `Query ${index + 1}`} severity="error" key={index}>
          {renderError(error)}
        </Alert>
      ))}
    </>
  );
};
