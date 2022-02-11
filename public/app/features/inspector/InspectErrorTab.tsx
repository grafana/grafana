import React from 'react';
import { DataQueryError } from '@grafana/data';
import { JSONFormatter } from '@grafana/ui';

interface InspectErrorTabProps {
  error?: DataQueryError;
}

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
      const [msg, json] = error.message.split(/\{(.+)/);
      const jsonError = JSON.parse('{' + json);
      const title = msg && msg !== '' ? <h3>{msg}</h3> : null;
      return (
        <>
          {title}
          <JSONFormatter json={jsonError} open={5} />
        </>
      );
    } catch {
      return <div>{error.message}</div>;
    }
  }
  return <JSONFormatter json={error} open={2} />;
};
