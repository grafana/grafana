import React, { FC, ReactNode } from 'react';
import classNames from 'classnames';
import { AppNotificationSeverity } from 'app/types';

interface Props {
  title: string;
  button?: {
    text?: string;
    onClick: (event: React.MouseEvent) => void;
  };
  severity?: AppNotificationSeverity;
  children?: ReactNode;
  icon?: string;
}

function getIconFromSeverity(severity: AppNotificationSeverity = AppNotificationSeverity.Error): string {
  switch (severity) {
    case AppNotificationSeverity.Error: {
      return 'fa fa-exclamation-triangle';
    }
    case AppNotificationSeverity.Warning: {
      return 'fa fa-exclamation-triangle';
    }
    case AppNotificationSeverity.Info: {
      return 'fa fa-info-circle';
    }
    case AppNotificationSeverity.Success: {
      return 'fa fa-check';
    }
    default:
      return '';
  }
}

export const Alert: FC<Props> = props => {
  const { title, button, children, severity, icon } = props;
  const alertClass = classNames('alert', `alert-${severity}`);
  return (
    <div className="alert-container">
      <div className={alertClass}>
        <div className="alert-icon">
          <i className={icon || getIconFromSeverity(severity)} />
        </div>
        <div className="alert-body">
          <div className="alert-title">{title}</div>
          {children && <div className="alert-text">{children}</div>}
        </div>
        {button && (
          <div className="alert-button">
            <button className="btn btn-outline-danger" onClick={button.onClick}>
              {button.text}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
