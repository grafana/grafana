import React, { FC } from 'react';
import { UserSession } from 'app/types';

interface Props {
  sessions: UserSession[];
  className?: string;
  onSessionRevoke: (id: number) => void;
}

export const UserSessions: FC<Props> = ({ className, sessions, onSessionRevoke }) => {
  return (
    <>
      <table className={`${className} filter-table form-inline`}>
        <thead>
          <tr>
            <th>Last seen</th>
            <th>Logged on</th>
            <th>IP address</th>
            <th colSpan={2}>Browser &amp; OS</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session, index) => (
            <tr key={`${session.id}-${index}`}>
              <td>{session.isActive ? 'Now' : session.seenAt}</td>
              <td>{session.createdAt}</td>
              <td>{session.clientIp}</td>
              <td>{`${session.browser} on ${session.os} ${session.osVersion}`}</td>
              <td>
                <button className="btn btn-danger btn-small" onClick={() => onSessionRevoke(session.id)}>
                  <i className="fa fa-power-off" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
