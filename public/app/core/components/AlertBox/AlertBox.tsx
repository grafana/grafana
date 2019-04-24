import React, { FunctionComponent } from 'react';
import { AppNotificationSeverity } from 'app/types';

interface Props {
  title: string;
  icon?: string;
  text?: string;
  severity: AppNotificationSeverity;
  onClose?: () => void;
}

function getIconFromSeverity(severity: AppNotificationSeverity): string {
  switch (severity) {
    case AppNotificationSeverity.Error: {
      return 'fa fa-exclamation-triangle';
    }
    case AppNotificationSeverity.Success: {
      return 'fa fa-check';
    }
    default:
      return null;
  }
}

export const AlertBox: FunctionComponent<Props> = ({ title, icon, text, severity, onClose }) => {
  return (
    <div className={`alert alert-${severity}`}>
      <div className="alert-icon">
        <i className={icon || getIconFromSeverity(severity)} />
      </div>
      <div className="alert-body">
        <div className="alert-title">{title}</div>
        {text && <div className="alert-text">{text}</div>}
      </div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose}>
          <i className="fa fa fa-remove" />
        </button>
      )}
    </div>
  );
};
