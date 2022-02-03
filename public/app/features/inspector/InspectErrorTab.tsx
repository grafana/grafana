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
      const jsonError = JSON.parse(error.message);
      return <JSONFormatter json={jsonError} open={5} />;
    } catch {
      return <div>{error.message}</div>;
    }
  }
  return (
    <div>
      {error.status} : {error.statusText}
    </div>
  );
};
