import React from 'react';

import { DataQueryError } from '@grafana/data';
import { JSONFormatter } from '@grafana/ui';

interface InspectErrorTabProps {
  error?: DataQueryError;
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

export const InspectErrorTab: React.FC<InspectErrorTabProps> = ({ error }) => {
  if (!error) {
    return null;
  }
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
      return <div>{msg}</div>;
    } else {
      return (
        <>
          {msg !== '' && <h3>{msg}</h3>}
          <JSONFormatter json={json} open={5} />
        </>
      );
    }
  }
  return <JSONFormatter json={error} open={2} />;
};
