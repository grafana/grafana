import React from 'react';

interface Version {
  version: string;
  releaseDate: string;
  notes?: string;
}

interface Props {
  versions: Version[];
  installedVersion?: string;
}

export function Version({ versions, installedVersion }: Props) {

  if (!versions || versions.length === 0) {
    return <p>No version history was found.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Version</th>
          <th>Release Date</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((v) => {
          const isInstalled = v.version === installedVersion;
          return (
            <tr key={v.version}>
              <td>{v.version}{isInstalled && ' (installed)'}</td>
              <td>{v.releaseDate}</td>
              <td>{v.notes || '-'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
