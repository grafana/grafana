import React, { FC, ReactNode } from 'react';
import classNames from 'classnames';

export enum AlertVariant {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
}

interface AlertProps {
  title: string;
  button?: {
    text?: string;
    onClick: (event: React.MouseEvent) => void;
  };
  severity?: AlertVariant;
  children?: ReactNode;
}

function getIconFromSeverity(severity: AlertVariant): string {
  switch (severity) {
    case AlertVariant.Error: {
      return 'fa fa-exclamation-triangle';
    }
    case AlertVariant.Warning: {
      return 'fa fa-exclamation-triangle';
    }
    case AlertVariant.Info: {
      return 'fa fa-info-circle';
    }
    case AlertVariant.Success: {
      return 'fa fa-check';
    }
    default:
      return '';
  }
}

export const Alert: FC<AlertProps> = ({ title, button, children, severity = AlertVariant.Info }) => {
  const alertClass = classNames('alert', `alert-${severity}`);
  return (
    <div className="alert-container">
      <div className={alertClass}>
        <div className="alert-icon">
          <i className={getIconFromSeverity(severity)} />
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
