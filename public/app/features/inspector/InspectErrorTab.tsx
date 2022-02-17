import React from 'react';
import { DataQueryError } from '@grafana/data';
import { JSONFormatter } from '@grafana/ui';

interface InspectErrorTabProps {
  error?: DataQueryError;
}

const parseErrorMessage = (message: string): { msg: string; json: any } => {
  const [msg, json] = message.split(/(\{.+)/);
  const jsonError = JSON.parse(json);
  return {
    msg,
    json: jsonError,
  };
};

export const InspectErrorTab: React.FC<InspectErrorTabProps> = ({ error }) => {
  if (!error) {
    return null;
  }
  if (error.data) {
    return (
      <>
        <h3>{error.data.message}</h3>
        <JSONFormatter json={error} open={2} />
      </>
    );
  }
  if (error.message) {
    try {
      const { msg, json } = parseErrorMessage(error.message);
      return (
        <>
          {msg && msg !== '' && <h3>{msg}</h3>}
          {json && json !== '' && <JSONFormatter json={json} open={5} />}
        </>
      );
    } catch {
      return <div>{error.message}</div>;
    }
  }
  return <JSONFormatter json={error} open={2} />;
};
